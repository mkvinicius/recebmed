import { parsePdfText } from "./pdf-util";
import { getComplexParsingProvider } from "./llm";
import { extractTextFromImage } from "./ocr";
import { ocrPdfPages } from "./pdf-ocr";
import { storage } from "./storage";
import { buildTemplatePrompt } from "./document-validator";

export interface PdfExtractedEntry {
  patientName: string;
  patientBirthDate?: string;
  procedureDate: string;
  procedureName?: string;
  insuranceProvider?: string;
  reportedValue: string;
  description?: string;
}

const EXTRACTION_PROMPT = `Você é um assistente especializado em extrair dados de relatórios financeiros de clínicas médicas e hospitais brasileiros.
Cada clínica/hospital tem SEU PRÓPRIO formato de relatório — colunas, nomes e disposição variam muito.
Sua tarefa: analisar o conteúdo, entender a estrutura daquele relatório específico, e extrair TODOS os registros.

FORMATOS COMUNS QUE VOCÊ VAI ENCONTRAR:
- "Conta Corrente Equipe Médica" (hospitais): colunas Data, Paciente, Espécie, Repasse, Valor, Status
- Guias TISS (convênios): número da guia, beneficiário, procedimento, código, valor
- Extratos de produção: médico, paciente, data, procedimento, valor
- Notas fiscais de serviços médicos: tomador, serviço, valor
- Relatórios de repasse: profissional, paciente, convênio, procedimento, valor pago
- Planilhas exportadas de sistemas hospitalares (qualquer formato)

PARA CADA REGISTRO, EXTRAIA ESTES 7 CAMPOS:

1. patientName (OBRIGATÓRIO): Nome do paciente/beneficiário/cliente.
   Pode estar em colunas como: "Paciente", "Beneficiário", "Cliente", "Nome", "Tomador"

2. procedureDate (OBRIGATÓRIO): Data do procedimento no formato YYYY-MM-DD.
   Pode estar em: "Data", "Dt. Atendimento", "Data Procedimento", "Competência"
   Se o relatório tem UMA data no cabeçalho para TODOS os registros, use essa data para todos.

3. procedureName: Nome/tipo do procedimento realizado.
   Pode estar em: "Procedimento", "Serviço", "Tipo", "Descrição", "Código"
   Se NÃO existir coluna de procedimento, use null — NÃO invente.

4. insuranceProvider: Convênio ou forma de pagamento.
   REGRAS DE CLASSIFICAÇÃO:
   - Se tem coluna "Convênio" com nome do plano (Unimed, Amil, etc.) → use o nome do convênio
   - Se tem coluna "Repasse" ou "Espécie" com formas de pagamento (PIX, Dinheiro, Cartão, Redecard, PACOTE, "PX - PIX", "DN - DINHEIRO", "CC - CARTAO CREDITO") → use "Particular"
   - Se a coluna diz "SUS" ou "Sistema Único de Saúde" → use "SUS"
   - Se NÃO tem nenhuma informação de convênio → use null
   - NUNCA confunda forma de pagamento (PIX, Redecard) com convênio de saúde
   - Quando encontrar código de espécie (ex: "PX", "DN", "CC", "RE"), mapeie: qualquer forma de pagamento direto = "Particular"

5. reportedValue: Valor financeiro em formato decimal com ponto.
   Pode estar em: "Valor", "Total", "Repasse", "Valor Pago", "Valor Líquido"
   CONVERSÃO DE VALORES BRASILEIROS:
   - "600,00" → "600.00"
   - "4.702,00" → "4702.00"
   - "1.000,00" → "1000.00"
   - "R$ 350,00" → "350.00"
   Se NÃO tem valor → use "0.00"

6. patientBirthDate: Data de nascimento no formato YYYY-MM-DD. Se não disponível → null

7. description: Observações/notas adicionais. Se não disponível → null

REGRAS IMPORTANTES:
- Extraia TODAS as linhas de pacientes, mesmo repetidas ou com dados parciais
- Ignore SEMPRE: cabeçalhos, rodapés, totais, subtotais, resumos
- Ignore linhas que começam com "Observação:" ou "Obs:" — NÃO são registros de pacientes
- Cada linha de paciente/transação é um registro ÚNICO — trate separadamente
- Se um paciente aparece 2x com valores diferentes → extraia as 2 ocorrências separadas
- Se o documento tem múltiplas páginas, extraia de TODAS
- Se uma coluna não existe naquele formato → use null, NUNCA invente dados
- Em documentos NOTAFLMED ou "Conta Corrente": a coluna "Espécie" indica forma de pagamento, NÃO convênio

Responda APENAS com um array JSON válido. Sem markdown, sem explicações, sem texto antes ou depois do JSON.`;

function sanitizeValue(val: string | undefined | null): string {
  if (!val) return "0.00";
  let v = val.toString().replace(/[R$\s€£¥]/g, "").trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(v)) {
    v = v.replace(/\./g, "").replace(",", ".");
  } else {
    v = v.replace(",", ".");
  }
  const num = parseFloat(v);
  return isNaN(num) ? "0.00" : num.toFixed(2);
}

function sanitizeDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  const d = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const parsed = new Date(d + "T00:00:00");
    return isNaN(parsed.getTime()) ? null : d;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [day, month, year] = d.split("/");
    const iso = `${year}-${month}-${day}`;
    const parsed = new Date(iso + "T00:00:00");
    return isNaN(parsed.getTime()) ? null : iso;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
    const [day, month, year] = d.split("-");
    const iso = `${year}-${month}-${day}`;
    const parsed = new Date(iso + "T00:00:00");
    return isNaN(parsed.getTime()) ? null : iso;
  }
  const parsed = new Date(d);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return null;
}

const PAYMENT_METHOD_KEYWORDS = [
  "pix", "px", "dinheiro", "dn", "cartao", "cartão", "cc",
  "redecard", "re", "pacote", "debito", "débito", "credito", "crédito",
  "transferencia", "transferência", "boleto", "cheque",
];

function isPaymentMethod(value: string): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const parts = normalized.split(/[\s\-–]+/);
  return parts.some(p => PAYMENT_METHOD_KEYWORDS.includes(p));
}

function sanitizeEntry(raw: any): PdfExtractedEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const name = (raw.patientName || raw.patient_name || raw.nome || raw.paciente || "").toString().trim();
  if (!name || name.length < 2) return null;

  const procDate = sanitizeDate(raw.procedureDate || raw.procedure_date || raw.data || raw.date);
  if (!procDate) return null;

  let insurance = (raw.insuranceProvider || raw.insurance_provider || raw.convenio || raw.convênio || raw.insurance || "").toString().trim();
  const procedure = (raw.procedureName || raw.procedure_name || raw.procedimento || raw.procedure || "").toString().trim();

  if (isPaymentMethod(insurance)) {
    insurance = "Particular";
  }
  if (isPaymentMethod(procedure) && !insurance) {
    insurance = "Particular";
  }

  return {
    patientName: name,
    patientBirthDate: sanitizeDate(raw.patientBirthDate || raw.patient_birth_date || raw.nascimento || raw.birthdate) || undefined,
    procedureDate: procDate,
    procedureName: procedure || undefined,
    insuranceProvider: insurance || undefined,
    reportedValue: sanitizeValue(raw.reportedValue || raw.reported_value || raw.valor || raw.value),
    description: (raw.description || raw.descricao || raw.descrição || raw.observacao || raw.obs || "").toString().trim() || undefined,
  };
}

function parseAIResponse(content: string): PdfExtractedEntry[] {
  try {
    let cleaned = content.replace(/```json\s*|```\s*/g, "").trim();
    const firstBracket = cleaned.indexOf("[");
    if (firstBracket > 0) cleaned = cleaned.substring(firstBracket);
    const lastBracket = cleaned.lastIndexOf("]");
    if (lastBracket > 0) cleaned = cleaned.substring(0, lastBracket + 1);

    const parsed = JSON.parse(cleaned);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items.map(sanitizeEntry).filter((e): e is PdfExtractedEntry => e !== null);
  } catch {
    try {
      const objectPattern = /\{[^{}]+\}/g;
      const matches = content.match(objectPattern);
      if (matches && matches.length > 0) {
        return matches
          .map(m => { try { return sanitizeEntry(JSON.parse(m)); } catch { return null; } })
          .filter((e): e is PdfExtractedEntry => e !== null);
      }
    } catch {}
    return [];
  }
}

export async function extractPdfDataWithTemplate(pdfBuffer: Buffer, templateMappingJson: string): Promise<PdfExtractedEntry[]> {
  let text: string;
  try {
    text = await parsePdfText(pdfBuffer);
  } catch (pdfErr) {
    console.error("PDF parse error:", pdfErr);
    throw new Error("Não foi possível ler o PDF.");
  }

  if (!text || text.trim().length < 20) {
    console.log("[PDF-Template] Texto insuficiente, tentando OCR em PDF escaneado...");
    const ocrText = await ocrPdfPages(pdfBuffer);
    if (ocrText) {
      text = ocrText;
    } else {
      throw new Error("O PDF não contém texto extraível e o OCR não conseguiu ler.");
    }
  }

  const templateHint = buildTemplatePrompt(templateMappingJson);
  const provider = getComplexParsingProvider();
  try {
    const result = await withRetry(() => provider.chatCompletion({
      messages: [
        { role: "system", content: EXTRACTION_PROMPT + templateHint },
        { role: "user", content: `Texto extraído do PDF do relatório da clínica:\n\n${text}` },
      ],
      maxTokens: 16000,
    }));
    const results = parseAIResponse(result.content);
    console.log(`[${provider.name}] PDF template-aware extraction: ${results.length} entries`);
    return results;
  } catch (aiErr: any) {
    console.error("Template-aware AI extraction error:", aiErr?.message || aiErr);
    throw handleAIError(aiErr);
  }
}

export async function extractPdfData(pdfBuffer: Buffer): Promise<PdfExtractedEntry[]> {
  let text: string;
  try {
    text = await parsePdfText(pdfBuffer);
  } catch (pdfErr) {
    console.error("PDF parse error:", pdfErr);
    throw new Error("Não foi possível ler o PDF. O arquivo pode estar corrompido ou protegido por senha.");
  }

  if (!text || text.trim().length < 20) {
    console.log("[PDF] Texto insuficiente, tentando OCR em PDF escaneado...");
    const ocrText = await ocrPdfPages(pdfBuffer);
    if (ocrText) {
      text = ocrText;
    } else {
      throw new Error("O PDF não contém texto extraível e o OCR não conseguiu ler. Tente enviar como imagem (foto/screenshot).");
    }
  }

  console.log(`PDF text extracted: ${text.length} chars, first 200: ${text.substring(0, 200)}`);

  const provider = getComplexParsingProvider();
  try {
    const result = await withRetry(() => provider.chatCompletion({
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Texto extraído do PDF do relatório da clínica:\n\n${text}` },
      ],
      maxTokens: 16000,
    }));

    const content = result.content;
    const results = parseAIResponse(content);
    console.log(`[${provider.name}] PDF AI extraction: ${results.length} entries from ${text.length} chars`);

    if (results.length === 0 && text.length > 100) {
      console.warn("AI returned 0 entries from non-empty PDF. Response:", content.substring(0, 500));
    }

    return results;
  } catch (aiErr: any) {
    console.error("AI extraction error:", aiErr?.message || aiErr);
    throw handleAIError(aiErr);
  }
}

function handleAIError(aiErr: any): Error {
  const msg = (aiErr?.message || "").toLowerCase();
  const isQuota = msg.includes("quota") || msg.includes("billing") || msg.includes("exceeded your current");
  const isRateLimit = aiErr?.status === 429 || msg.includes("rate");
  if (isQuota) {
    return new Error("Cota da API de IA excedida. O serviço será retomado automaticamente quando a cota for renovada. Tente novamente mais tarde.");
  }
  if (isRateLimit) {
    return new Error("Serviço de IA temporariamente sobrecarregado. Aguarde 1 minuto e tente novamente.");
  }
  return new Error("Erro na extração com IA. Tente novamente em alguns instantes.");
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 3000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      const isRetryable = err?.status === 429 && !msg.includes("quota") && !msg.includes("billing") && !msg.includes("exceeded your current");
      if (isRetryable && attempt < retries) {
        const wait = delayMs * Math.pow(2, attempt);
        console.log(`Rate limited, retrying in ${wait}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

export async function extractImageData(base64Image: string): Promise<PdfExtractedEntry[]> {
  const provider = getComplexParsingProvider();

  const rawBase64 = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
  const ocr = await extractTextFromImage(rawBase64);

  try {
    let result;
    if (ocr.usable) {
      console.log(`[OCR+LLM] OCR ok (${ocr.confidence.toFixed(0)}%), enviando texto extraído para IA`);
      result = await withRetry(() => provider.chatCompletion({
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: `Texto extraído via OCR de relatório de clínica médica:\n\n${ocr.text}` },
        ],
        maxTokens: 16000,
      }));
    } else {
      console.log(`[Vision] OCR insuficiente (${ocr.confidence.toFixed(0)}%), enviando imagem para IA`);
      result = await withRetry(() => provider.chatCompletion({
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analise esta imagem de relatório de clínica médica e extraia todos os registros:" },
              { type: "image_url", image_url: { url: base64Image } },
            ],
          },
        ],
        maxTokens: 16000,
      }));
    }

    const results = parseAIResponse(result.content);
    console.log(`[${provider.name}] Image extraction: ${results.length} entries (OCR: ${ocr.usable ? "sim" : "não"})`);
    return results;
  } catch (aiErr: any) {
    console.error("Image AI extraction error:", aiErr?.message || aiErr);
    throw handleAIError(aiErr);
  }
}

export function extractCsvData(csvText: string): PdfExtractedEntry[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const separator = headerLine.includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

  const findCol = (aliases: string[]) => headers.findIndex(h => aliases.some(a => h === a || h.includes(a)));

  const patientIdx = findCol(["paciente", "patient", "patientname", "patient_name", "nome", "nome_paciente", "nome do paciente", "beneficiario", "cliente"]);
  const dateIdx = findCol(["data", "date", "proceduredate", "procedure_date", "data_procedimento", "data_atendimento", "dt_atendimento", "data atendimento", "data do procedimento", "dt_procedimento"]);
  const birthIdx = findCol(["nascimento", "data_nascimento", "data de nascimento", "birth", "birthdate", "birth_date", "dt_nascimento"]);
  const procedureIdx = findCol(["procedimento", "procedure", "procedurename", "procedure_name", "nome_procedimento", "servico", "tipo_servico", "especie"]);
  const insuranceIdx = findCol(["convenio", "convênio", "insurance", "insuranceprovider", "insurance_provider", "plano", "operadora", "repasse", "forma_pagamento"]);
  const descIdx = findCol(["descricao", "descricão", "description", "observacao", "observação", "obs", "nota"]);
  const valueIdx = findCol(["valor", "value", "reportedvalue", "reported_value", "valor_reportado", "preco", "preço", "price", "total", "valor_total", "valor_pago"]);

  if (patientIdx === -1 || dateIdx === -1) return [];

  const results: PdfExtractedEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ""));
    const patientName = cols[patientIdx] || "";
    if (!patientName) continue;

    const procedureDate = sanitizeDate(cols[dateIdx]) || "";
    if (!procedureDate) continue;

    const entry = sanitizeEntry({
      patientName,
      procedureDate,
      patientBirthDate: birthIdx >= 0 ? cols[birthIdx] : undefined,
      procedureName: procedureIdx >= 0 ? cols[procedureIdx] : undefined,
      insuranceProvider: insuranceIdx >= 0 ? cols[insuranceIdx] : undefined,
      reportedValue: valueIdx >= 0 ? cols[valueIdx] : "0.00",
      description: descIdx >= 0 ? cols[descIdx] : undefined,
    });
    if (entry) results.push(entry);
  }
  return results;
}

export async function extractCsvWithAI(csvText: string): Promise<PdfExtractedEntry[]> {
  const preview = csvText.substring(0, 5000);
  const provider = getComplexParsingProvider();
  try {
    const result = await withRetry(() => provider.chatCompletion({
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Conteúdo de planilha CSV/Excel exportada de sistema de clínica. Identifique as colunas automaticamente e extraia os registros:\n\n${preview}` },
      ],
      maxTokens: 16000,
    }));
    const results = parseAIResponse(result.content);
    console.log(`[${provider.name}] CSV AI fallback extraction: ${results.length} entries`);
    return results;
  } catch (aiErr: any) {
    console.error("CSV AI extraction error:", aiErr?.message || aiErr);
    throw handleAIError(aiErr);
  }
}

export function generateCsvTemplate(): string {
  const bom = "\uFEFF";
  const header = "paciente;nascimento;data;procedimento;convenio;valor";
  const example1 = "João Silva;15/06/1985;01/03/2026;Consulta cardiológica;Unimed;250.00";
  const example2 = "Maria Santos;22/11/1990;05/03/2026;Retorno dermatologia;Particular;180.50";
  const example3 = "Pedro Oliveira;03/08/1978;10/03/2026;Sleeve;SulAmérica;1500.00";
  return bom + [header, example1, example2, example3].join("\n");
}

function levenshteinDistance(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  const matrix: number[][] = [];
  for (let i = 0; i <= la.length; i++) matrix[i] = [i];
  for (let j = 0; j <= lb.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= la.length; i++) {
    for (let j = 1; j <= lb.length; j++) {
      const cost = la[i - 1] === lb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[la.length][lb.length];
}

function datesWithinDays(d1: Date, d2: Date, days: number): boolean {
  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  return diffMs / (1000 * 60 * 60 * 24) <= days;
}

function normalizeStr(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export interface ReconciliationResult {
  reconciled: Array<{ entryId: string; reportId: string; patientName: string; procedureDate: string; entryValue: string | null; reportValue: string; matchDetails?: string }>;
  divergent: Array<{ entryId: string; reportId: string; patientName: string; procedureDate: string; entryValue: string | null; reportValue: string; divergenceReason: string }>;
  pending: Array<{ entryId: string; patientName: string; procedureDate: string; entryValue: string | null }>;
  unmatchedClinic: Array<{ reportId: string; patientName: string; procedureDate: string; reportValue: string; insuranceProvider?: string; procedureName?: string }>;
}

interface MatchScore {
  report: any;
  score: number;
  totalFields: number;
  matchedFields: string[];
  divergentFields: string[];
  nameMatched: boolean;
  confidence: number;
}

function nameMatchThreshold(nameLen: number): number {
  if (nameLen <= 5) return 1;
  if (nameLen <= 10) return 2;
  return Math.max(3, Math.ceil(nameLen * 0.2));
}

function scoreMatch(entry: any, report: any): MatchScore {
  let score = 0;
  let filledFields = 0;
  const matchedFields: string[] = [];
  const divergentFields: string[] = [];

  const nameDistance = levenshteinDistance(entry.patientName, report.patientName);
  const nameLen = Math.max(normalizeStr(entry.patientName).length, normalizeStr(report.patientName).length);
  const nameMatched = nameDistance <= nameMatchThreshold(nameLen);
  filledFields++;
  if (nameMatched) {
    score++;
    matchedFields.push("nome");
  } else {
    divergentFields.push(`Nome: "${entry.patientName}" ≠ "${report.patientName}"`);
  }

  const entryDate = new Date(entry.procedureDate);
  const reportDate = new Date(report.procedureDate);
  filledFields++;
  if (datesWithinDays(entryDate, reportDate, 3)) {
    score++;
    matchedFields.push("data");
  } else {
    const ed = entryDate.toLocaleDateString("pt-BR");
    const rd = reportDate.toLocaleDateString("pt-BR");
    divergentFields.push(`Data: ${ed} ≠ ${rd}`);
  }

  const entryBirth = normalizeStr(entry.patientBirthDate);
  const reportBirth = normalizeStr(report.patientBirthDate);
  if (entryBirth && reportBirth) {
    filledFields++;
    if (entryBirth === reportBirth) {
      score++;
      matchedFields.push("nascimento");
    } else {
      divergentFields.push(`Nascimento: ${entry.patientBirthDate} ≠ ${report.patientBirthDate}`);
    }
  }

  const entryProc = normalizeStr(entry.procedureName || entry.description);
  const reportProc = normalizeStr(report.procedureName || report.description);
  if (entryProc && reportProc) {
    filledFields++;
    const procDistance = levenshteinDistance(entryProc, reportProc);
    const maxLen = Math.max(entryProc.length, reportProc.length);
    if (procDistance <= Math.ceil(maxLen * 0.3) || entryProc.includes(reportProc) || reportProc.includes(entryProc)) {
      score++;
      matchedFields.push("procedimento");
    } else {
      divergentFields.push(`Procedimento: "${entry.procedureName || entry.description}" ≠ "${report.procedureName || report.description}"`);
    }
  }

  const entryIns = normalizeStr(entry.insuranceProvider);
  const reportIns = normalizeStr(report.insuranceProvider);
  if (entryIns && reportIns) {
    filledFields++;
    const insDistance = levenshteinDistance(entryIns, reportIns);
    if (insDistance <= 3 || entryIns.includes(reportIns) || reportIns.includes(entryIns)) {
      score++;
      matchedFields.push("convênio");
    } else {
      divergentFields.push(`Convênio: "${entry.insuranceProvider}" ≠ "${report.insuranceProvider}"`);
    }
  }

  const totalFields = filledFields;
  const confidence = totalFields > 0 ? Math.round((score / totalFields) * 100) : 0;
  return { report, score, totalFields, matchedFields, divergentFields, nameMatched, confidence };
}

function computeAiMatchConfidence(entry: any, report: any): number {
  const ms = scoreMatch(entry, report);
  return ms.confidence;
}

const AI_RECONCILIATION_PROMPT = `Você é um assistente de conferência financeira médica.

REGRA PRINCIPAL: O matching é feito pelo NOME DO PACIENTE. Procure na lista da clínica um paciente com nome igual ou similar ao do médico. NÃO use a posição/índice na lista — o paciente pode estar em qualquer posição.

PROCESSO:
1. Para cada lançamento do médico, PROCURE pelo nome do paciente na lista da clínica
2. Se encontrar um nome similar (variações de grafia são aceitas), valide os dados complementares:
   - Data de atendimento (pequenas diferenças de 1-3 dias são aceitas)
   - Data de nascimento (se disponível)
   - Procedimento realizado
   - Convênio/plano de saúde
3. Determine o status:
   - "received": Nome encontrado e dados complementares batem
   - "divergent": Nome encontrado mas algum dado complementar diverge (informe qual)
   - "pending": Nome NÃO encontrado na lista da clínica (nenhum paciente similar)

REGRAS DE DIVERGÊNCIA:
- O NOME DO PACIENTE é o campo mais importante para matching
- Se um campo está preenchido em um lado e VAZIO no outro, NÃO é divergência — ignore esse campo
- Divergência SÓ ocorre quando AMBOS os lados têm o campo preenchido e os valores são DIFERENTES
- Exemplo: médico tem convênio "Unimed" e clínica tem vazio → NÃO é divergente
- Exemplo: médico tem convênio "Unimed" e clínica tem "Amil" → É divergente
- NÃO compare valores financeiros
- Se o paciente aparece mais de uma vez, use a combinação nome+data para identificar o registro correto
- NUNCA faça match por posição na lista — sempre por nome
- Se dois pacientes têm nomes muito diferentes, NUNCA são match mesmo que estejam na mesma posição

Responda com um array JSON:
[{"entryIndex": 0, "reportIndex": 3, "status": "received", "divergenceReason": null}, ...]

entryIndex = índice do lançamento do médico (0-based)
reportIndex = índice do registro da clínica que corresponde pelo NOME (0-based), ou null se não encontrado
Responda APENAS com JSON válido, sem markdown.`;

const AI_BATCH_SIZE = 30;

async function aiReconciliationBatch(
  entries: any[],
  reports: any[],
  entryOffset: number
): Promise<Array<{ entryIndex: number; reportIndex: number | null; status: string; divergenceReason?: string }>> {
  if (entries.length === 0 || reports.length === 0) return [];

  const entrySummary = entries.map((e, i) => ({
    idx: i,
    nome: e.patientName,
    nascimento: e.patientBirthDate || "N/D",
    data: new Date(e.procedureDate).toLocaleDateString("pt-BR"),
    procedimento: e.procedureName || e.description || "N/D",
    convenio: e.insuranceProvider || "N/D",
  }));

  const reportSummary = reports.map((r, i) => ({
    idx: i,
    nome: r.patientName,
    nascimento: r.patientBirthDate || "N/D",
    data: new Date(r.procedureDate).toLocaleDateString("pt-BR"),
    procedimento: r.procedureName || r.description || "N/D",
    convenio: r.insuranceProvider || "N/D",
  }));

  try {
    const provider = getComplexParsingProvider();
    const result = await withRetry(() => provider.chatCompletion({
      messages: [
        { role: "system", content: AI_RECONCILIATION_PROMPT },
        { role: "user", content: `Lançamentos do médico (${entries.length}):\n${JSON.stringify(entrySummary, null, 2)}\n\nRegistros da clínica (${reports.length}):\n${JSON.stringify(reportSummary, null, 2)}` },
      ],
      maxTokens: 8000,
    }));

    const cleaned = result.content.replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    console.log(`[${provider.name}] AI reconciliation: ${Array.isArray(parsed) ? parsed.length : 0} matches`);
    return Array.isArray(parsed) ? parsed.map((r: any) => ({ ...r, entryIndex: r.entryIndex + entryOffset })) : [];
  } catch (err) {
    console.error("AI reconciliation batch error:", err);
    return [];
  }
}

export async function runReconciliation(doctorId: string): Promise<ReconciliationResult> {
  const pendingEntries = await storage.getPendingDoctorEntries(doctorId);
  const unmatchedReports = await storage.getUnmatchedClinicReports(doctorId);

  const result: ReconciliationResult = {
    reconciled: [],
    divergent: [],
    pending: [],
    unmatchedClinic: [],
  };

  if (pendingEntries.length === 0 && unmatchedReports.length === 0) return result;

  if (pendingEntries.length === 0) {
    for (const report of unmatchedReports) {
      result.unmatchedClinic.push({
        reportId: report.id,
        patientName: report.patientName,
        procedureDate: report.procedureDate.toISOString(),
        reportValue: report.reportedValue,
        insuranceProvider: report.insuranceProvider || undefined,
        procedureName: report.procedureName || undefined,
      });
    }
    return result;
  }

  if (unmatchedReports.length === 0) {
    for (const entry of pendingEntries) {
      result.pending.push({
        entryId: entry.id,
        patientName: entry.patientName,
        procedureDate: entry.procedureDate.toISOString(),
        entryValue: entry.procedureValue,
      });
    }
    return result;
  }

  const usedReports = new Set<string>();
  const statusUpdates: Array<{ id: string; status: string; matchedReportId?: string | null; divergenceReason?: string | null }> = [];
  const reportMatchUpdates: Array<{ reportId: string; entryId: string }> = [];

  for (let batchStart = 0; batchStart < pendingEntries.length; batchStart += AI_BATCH_SIZE) {
    const entryBatch = pendingEntries.slice(batchStart, batchStart + AI_BATCH_SIZE);
    const availableReports = unmatchedReports.filter(r => !usedReports.has(r.id));
    if (availableReports.length === 0) break;

    const aiResults = await aiReconciliationBatch(entryBatch, availableReports, batchStart);

    for (const aiMatch of aiResults) {
      const entry = pendingEntries[aiMatch.entryIndex];
      if (!entry) continue;

      if (aiMatch.reportIndex !== null && aiMatch.reportIndex !== undefined) {
        const report = availableReports[aiMatch.reportIndex];
        if (!report || usedReports.has(report.id)) continue;

        const entryNameNorm = normalizeStr(entry.patientName);
        const reportNameNorm = normalizeStr(report.patientName);
        const nameCheck = levenshteinDistance(entryNameNorm, reportNameNorm);
        const safetyLen = Math.max(entryNameNorm.length, reportNameNorm.length);
        const safetyLimit = nameMatchThreshold(safetyLen) + 2;
        if (nameCheck > safetyLimit) {
          console.log(`[Reconciliation] AI matched by position? Rejecting: "${entry.patientName}" vs "${report.patientName}" (distance=${nameCheck}, threshold=${safetyLimit})`);
          continue;
        }

        usedReports.add(report.id);

        const aiConfidence = computeAiMatchConfidence(entry, report);

        if (aiMatch.status === "received") {
          result.reconciled.push({
            entryId: entry.id,
            reportId: report.id,
            patientName: entry.patientName,
            procedureDate: entry.procedureDate.toISOString(),
            entryValue: entry.procedureValue,
            reportValue: report.reportedValue,
          });
          statusUpdates.push({ id: entry.id, status: "reconciled", matchedReportId: report.id, divergenceReason: null, matchConfidence: aiConfidence });
          reportMatchUpdates.push({ reportId: report.id, entryId: entry.id });
        } else if (aiMatch.status === "divergent") {
          const reason = aiMatch.divergenceReason || "Dados parcialmente diferentes";
          result.divergent.push({
            entryId: entry.id,
            reportId: report.id,
            patientName: entry.patientName,
            procedureDate: entry.procedureDate.toISOString(),
            entryValue: entry.procedureValue,
            reportValue: report.reportedValue,
            divergenceReason: reason,
          });
          statusUpdates.push({ id: entry.id, status: "divergent", matchedReportId: report.id, divergenceReason: reason, matchConfidence: aiConfidence });
          reportMatchUpdates.push({ reportId: report.id, entryId: entry.id });
        }
      }
    }
  }

  const processedEntryIds = new Set([
    ...result.reconciled.map(r => r.entryId),
    ...result.divergent.map(r => r.entryId),
  ]);

  for (const entry of pendingEntries) {
    if (processedEntryIds.has(entry.id)) continue;

    let bestMatch: MatchScore | null = null;
    for (const report of unmatchedReports) {
      if (usedReports.has(report.id)) continue;
      const ms = scoreMatch(entry, report);
      if (!ms.nameMatched) continue;
      if (!bestMatch || ms.score > bestMatch.score) {
        bestMatch = ms;
      }
    }

    if (bestMatch && bestMatch.nameMatched && bestMatch.score >= Math.ceil(bestMatch.totalFields * 0.7)) {
      usedReports.add(bestMatch.report.id);
      result.reconciled.push({
        entryId: entry.id,
        reportId: bestMatch.report.id,
        patientName: entry.patientName,
        procedureDate: entry.procedureDate.toISOString(),
        entryValue: entry.procedureValue,
        reportValue: bestMatch.report.reportedValue,
        matchDetails: bestMatch.matchedFields.join(", "),
      });
      statusUpdates.push({ id: entry.id, status: "reconciled", matchedReportId: bestMatch.report.id, divergenceReason: null, matchConfidence: bestMatch.confidence });
      reportMatchUpdates.push({ reportId: bestMatch.report.id, entryId: entry.id });
    } else if (bestMatch && bestMatch.nameMatched && bestMatch.divergentFields.length > 0) {
      usedReports.add(bestMatch.report.id);
      const reason = bestMatch.divergentFields.join("; ");
      result.divergent.push({
        entryId: entry.id,
        reportId: bestMatch.report.id,
        patientName: entry.patientName,
        procedureDate: entry.procedureDate.toISOString(),
        entryValue: entry.procedureValue,
        reportValue: bestMatch.report.reportedValue,
        divergenceReason: reason,
      });
      statusUpdates.push({ id: entry.id, status: "divergent", matchedReportId: bestMatch.report.id, divergenceReason: reason, matchConfidence: bestMatch.confidence });
      reportMatchUpdates.push({ reportId: bestMatch.report.id, entryId: entry.id });
    } else {
      result.pending.push({
        entryId: entry.id,
        patientName: entry.patientName,
        procedureDate: entry.procedureDate.toISOString(),
        entryValue: entry.procedureValue,
      });
    }
  }

  for (const report of unmatchedReports) {
    if (usedReports.has(report.id)) continue;
    result.unmatchedClinic.push({
      reportId: report.id,
      patientName: report.patientName,
      procedureDate: report.procedureDate.toISOString(),
      reportValue: report.reportedValue,
      insuranceProvider: report.insuranceProvider || undefined,
      procedureName: report.procedureName || undefined,
    });
  }

  if (statusUpdates.length > 0) {
    await storage.batchUpdateDoctorEntryStatus(statusUpdates);
  }
  if (reportMatchUpdates.length > 0) {
    await storage.batchMarkClinicReportsMatched(reportMatchUpdates);
  }

  const msgs: string[] = [];
  if (result.reconciled.length > 0) msgs.push(`${result.reconciled.length} conferidos`);
  if (result.divergent.length > 0) msgs.push(`${result.divergent.length} com divergência`);
  if (result.pending.length > 0) msgs.push(`${result.pending.length} seus lançamentos sem match na clínica`);
  if (result.unmatchedClinic.length > 0) msgs.push(`${result.unmatchedClinic.length} pacientes da clínica que você ainda não lançou`);

  await storage.createNotification({
    doctorId,
    type: "reconciliation",
    title: "Conferência concluída",
    message: msgs.join(". "),
    read: false,
  });

  return result;
}
