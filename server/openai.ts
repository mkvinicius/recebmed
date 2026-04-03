import OpenAI, { toFile } from "openai";
import { getComplexParsingProvider } from "./llm";
import { extractTextFromImage } from "./ocr";

export function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
  });
}

function detectAudioExtension(buffer: Buffer): string {
  if (buffer.length < 12) return "wav";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "wav";
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "webm";
  if ((buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
      (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)) return "mp3";
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return "mp4";
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return "ogg";
  return "webm";
}

export interface FieldConfidence {
  patientName: "high" | "medium" | "low";
  procedureDate: "high" | "medium" | "low";
  insuranceProvider: "high" | "medium" | "low";
  description: "high" | "medium" | "low";
  procedureValue: "high" | "medium" | "low";
}

export interface ExtractedEntry {
  patientName: string;
  patientBirthDate?: string;
  procedureDate: string;
  procedureName?: string;
  insuranceProvider: string;
  description: string;
  procedureValue?: string;
  confidence?: FieldConfidence;
}

export interface CorrectionHint {
  field: string;
  originalValue: string;
  correctedValue: string;
}

function buildCorrectionContext(corrections: CorrectionHint[]): string {
  if (corrections.length === 0) return "";
  const grouped: Record<string, CorrectionHint[]> = {};
  for (const c of corrections) {
    if (!grouped[c.field]) grouped[c.field] = [];
    grouped[c.field].push(c);
  }
  let ctx = "\n\nAPRENDIZADO COM CORREÇÕES ANTERIORES - Use estas correções para melhorar a extração:\n";
  for (const [field, hints] of Object.entries(grouped)) {
    ctx += `Campo "${field}":\n`;
    for (const h of hints.slice(0, 5)) {
      ctx += `  - Antes: "${h.originalValue}" → Correto: "${h.correctedValue}"\n`;
    }
  }
  ctx += "\nAplique estes padrões de correção quando encontrar dados semelhantes.";
  return ctx;
}

const IMAGE_SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados de etiquetas hospitalares e documentos médicos.

**REGRA CRÍTICA DE FILTRAGEM:** Extraia dados APENAS de etiquetas e registros de PACIENTES. IGNORE completamente etiquetas de produtos, materiais ou dispositivos médicos (contêm "REF", "LOT", "SN", "Anvisa", "System", "Device", "Sterile", nome de fabricante). Se uma etiqueta for de material, passe para a próxima.

Analise a imagem e extraia TODOS os registros de pacientes encontrados.
Para cada paciente, extraia APENAS estes campos:
1. patientName: nome completo do paciente. Se não visível, retorne null.
2. patientBirthDate: data de nascimento no formato YYYY-MM-DD. Se não visível, retorne null.
3. procedureDate: data do procedimento no formato YYYY-MM-DD. Se não visível, retorne null.
4. procedureName: nome específico do procedimento (ex: "Endoscopia", "Sleeve"). Se não visível, retorne null.
5. insuranceProvider: nome do convênio/plano de saúde. Se não visível, retorne null.
6. description: descrição/observações do procedimento. Se não visível, retorne null.
7. procedureValue: valor em reais (apenas números com ponto decimal, ex: "150.00"). Se não visível, retorne null.
8. confidence: objeto com nível de confiança de CADA campo ("high", "medium", "low"). Campos: patientName, procedureDate, insuranceProvider, description, procedureValue.

**REGRAS IMPORTANTES:**
- Se um campo NÃO estiver visível na imagem, retorne null para ele — NUNCA use "Não identificado".
- Se insuranceProvider for "PACOTE", mapeie para "Particular".
- A imagem pode conter UM ou VÁRIOS pacientes.

Responda APENAS com um array JSON válido, sem markdown, sem explicações.
Se a imagem contiver APENAS etiquetas de materiais e NENHUM dado de paciente, retorne: []

Exemplo:
[{"patientName":"João Silva","procedureDate":"2026-01-29","insuranceProvider":"Particular","description":"Argônio","procedureValue":"250.00","confidence":{"patientName":"high","procedureDate":"high","insuranceProvider":"medium","description":"high","procedureValue":"high"}}]`;

export async function extractDataFromImage(base64Image: string, corrections: CorrectionHint[] = []): Promise<ExtractedEntry[]> {
  const correctionContext = buildCorrectionContext(corrections);
  const complexProvider = getComplexParsingProvider();
  let content: string;

  const ocr = await extractTextFromImage(base64Image);

  if (ocr.usable) {
    console.log(`[OCR+LLM] OCR ok (${ocr.confidence.toFixed(0)}%), enviando texto para IA`);
    const systemContent = IMAGE_SYSTEM_PROMPT + correctionContext;
    const result = await complexProvider.chatCompletion({
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: `Texto extraído via OCR de etiqueta/documento médico:\n\n${ocr.text}` },
      ],
      maxTokens: 4000,
    });
    content = result.content;
  } else {
    console.log(`[Vision] OCR insuficiente (${ocr.confidence.toFixed(0)}%), enviando imagem para IA`);
    const systemContent = IMAGE_SYSTEM_PROMPT + correctionContext;
    const userContent = "Extraia os dados de TODOS os pacientes/procedimentos deste documento.";
    const result = await complexProvider.chatCompletion({
      messages: [
        { role: "system", content: systemContent },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            { type: "text", text: userContent },
          ],
        },
      ],
      maxTokens: 4000,
    });
    content = result.content;
  }

  try {
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch {
    return [];
  }
}

export async function extractDataFromAudio(base64Audio: string, corrections: CorrectionHint[] = []): Promise<ExtractedEntry[]> {
  const client = getOpenAIClient();

  const audioBuffer = Buffer.from(base64Audio, "base64");
  const ext = detectAudioExtension(audioBuffer);
  const audioFile = await toFile(audioBuffer, `audio.${ext}`);

  const transcription = await client.audio.transcriptions.create({
    model: "gpt-4o-mini-transcribe",
    file: audioFile,
    response_format: "json",
  });

  const transcribedText = transcription.text;

  const audioSystemPrompt = `Você é um assistente especializado em extrair dados de transcrições de áudio de médicos.
O médico ditou informações sobre um ou mais procedimentos/consultas. Extraia TODOS os pacientes mencionados.
Para cada paciente, extraia:
- patientName: nome completo do paciente
- patientBirthDate: data de nascimento do paciente no formato YYYY-MM-DD (se mencionada, senão omita)
- procedureDate: data do procedimento no formato YYYY-MM-DD (se não mencionada, use a data de hoje: ${new Date().toISOString().split("T")[0]})
- procedureName: nome específico do procedimento (ex: "Consulta", "Endoscopia", "Sleeve")
- insuranceProvider: nome do convênio/plano de saúde (se não mencionado, use "Particular")
- description: descrição/observações do procedimento realizado
- procedureValue: valor do procedimento em reais (apenas números com ponto decimal, ex: "150.00"). Se não mencionado, omita o campo.
- confidence: um objeto com o nível de confiança de cada campo extraído. Valores possíveis: "high" (claramente ditado/identificado), "medium" (parcialmente audível, possível inferência), "low" (inaudível, incerto ou deduzido). Campos: patientName, procedureDate, insuranceProvider, description, procedureValue.

Responda APENAS com um array JSON válido, sem markdown, sem explicações.
Se não conseguir identificar algum campo, use "Não identificado" como valor e confidence "low".${buildCorrectionContext(corrections)}`;

  const complexProvider = getComplexParsingProvider();
  let content: string;

  if (complexProvider.name === "anthropic") {
    console.log("[LLM] Usando Claude (Anthropic) para análise de transcrição");
    const result = await complexProvider.chatCompletion({
      messages: [
        { role: "system", content: audioSystemPrompt },
        { role: "user", content: `Transcrição do áudio: "${transcribedText}"` },
      ],
      maxTokens: 2000,
    });
    content = result.content;
  } else {
    console.log("[LLM] Usando OpenAI para análise de transcrição");
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: audioSystemPrompt },
        { role: "user", content: `Transcrição do áudio: "${transcribedText}"` },
      ],
      max_completion_tokens: 2000,
    });
    content = response.choices[0]?.message?.content || "[]";
  }

  try {
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch {
    return [{
      patientName: "Não identificado",
      procedureDate: new Date().toISOString().split("T")[0],
      insuranceProvider: "Não identificado",
      description: transcribedText || "Não identificado",
      confidence: { patientName: "low", procedureDate: "low", insuranceProvider: "low", description: "low", procedureValue: "low" },
    }];
  }
}