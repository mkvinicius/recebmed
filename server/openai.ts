import OpenAI, { toFile } from "openai";

export function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
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
  procedureDate: string;
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

export async function extractDataFromImage(base64Image: string, corrections: CorrectionHint[] = []): Promise<ExtractedEntry[]> {
  const client = getOpenAIClient();
  const correctionContext = buildCorrectionContext(corrections);

  const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `Você é um assistente especializado em extrair dados de documentos médicos.

**REGRA CRÍTICA DE FILTRAGEM:** Sua tarefa é extrair dados APENAS de etiquetas e registros de PACIENTES. Você deve IGNORAR completamente qualquer etiqueta que seja de um produto, material ou dispositivo médico. Uma etiqueta de material tipicamente contém palavras como "REF", "LOT", "SN", "Anvisa", "System", "Device", "Sterile", "Fabricante", o nome de uma empresa fabricante (ex: "Spatz FGIA Inc.", "Medtronic", "Boston Scientific") e NÃO contém palavras como "Paciente", "Médico", "Convênio" ou "Plano de Saúde". Se uma etiqueta for de um material, não extraia NADA dela e simplesmente passe para a próxima etiqueta de paciente na imagem. Como exemplo: se você vir uma etiqueta como a do "Spatz3 Adjustable Balloon System" com REF/LOT/SN, você deve ignorá-la completamente. Se vir uma etiqueta com "Paciente: Matheus Henrique", você deve processá-la.

Analise a imagem e extraia TODOS os registros de pacientes encontrados (ignorando etiquetas de materiais).
Para cada paciente, extraia:
- patientName: nome completo do paciente
- procedureDate: data do procedimento no formato YYYY-MM-DD
- insuranceProvider: nome do convênio/plano de saúde
- description: descrição do procedimento realizado
- procedureValue: valor do procedimento em reais (apenas números com ponto decimal, ex: "150.00"). Se não encontrado, omita o campo.
- confidence: um objeto com o nível de confiança de cada campo extraído. Valores possíveis: "high" (claramente legível/identificado), "medium" (parcialmente legível, possível inferência), "low" (ilegível, incerto ou deduzido). Campos: patientName, procedureDate, insuranceProvider, description, procedureValue.

A imagem pode conter UM ou VÁRIOS pacientes (por exemplo, uma agenda médica com múltiplos atendimentos).

Responda APENAS com um JSON válido, sem markdown, sem explicações.
Se houver apenas 1 paciente, retorne um array com 1 objeto.
Se houver múltiplos pacientes, retorne um array com todos.
Se a imagem contiver APENAS etiquetas de materiais e NENHUM dado de paciente, retorne um array vazio: []

Exemplo:
[{"patientName":"João Silva","procedureDate":"2026-01-29","insuranceProvider":"Particular","description":"Argônio","procedureValue":"250.00","confidence":{"patientName":"high","procedureDate":"high","insuranceProvider":"medium","description":"high","procedureValue":"high"}}]

Se não conseguir identificar algum campo, use "Não identificado" como valor e confidence "low".${correctionContext}`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
          {
            type: "text",
            text: "Extraia os dados de TODOS os pacientes/procedimentos deste documento.",
          },
        ],
      },
    ],
    max_completion_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || "[]";
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch {
    return [{
      patientName: "Não identificado",
      procedureDate: new Date().toISOString().split("T")[0],
      insuranceProvider: "Não identificado",
      description: "Não identificado",
      confidence: { patientName: "low", procedureDate: "low", insuranceProvider: "low", description: "low", procedureValue: "low" },
    }];
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

  const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `Você é um assistente especializado em extrair dados de transcrições de áudio de médicos.
O médico ditou informações sobre um ou mais procedimentos/consultas. Extraia TODOS os pacientes mencionados.
Para cada paciente, extraia:
- patientName: nome completo do paciente
- procedureDate: data do procedimento no formato YYYY-MM-DD (se não mencionada, use a data de hoje: ${new Date().toISOString().split("T")[0]})
- insuranceProvider: nome do convênio/plano de saúde (se não mencionado, use "Particular")
- description: descrição do procedimento realizado
- procedureValue: valor do procedimento em reais (apenas números com ponto decimal, ex: "150.00"). Se não mencionado, omita o campo.
- confidence: um objeto com o nível de confiança de cada campo extraído. Valores possíveis: "high" (claramente ditado/identificado), "medium" (parcialmente audível, possível inferência), "low" (inaudível, incerto ou deduzido). Campos: patientName, procedureDate, insuranceProvider, description, procedureValue.

Responda APENAS com um array JSON válido, sem markdown, sem explicações.
Se não conseguir identificar algum campo, use "Não identificado" como valor e confidence "low".${buildCorrectionContext(corrections)}`,
      },
      {
        role: "user",
        content: `Transcrição do áudio: "${transcribedText}"`,
      },
    ],
    max_completion_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || "[]";
  try {
    const parsed = JSON.parse(content);
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