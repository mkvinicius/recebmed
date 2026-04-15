import { parsePdfText } from "./pdf-util";
import { getComplexParsingProvider } from "./llm";
import { extractTextFromImage } from "./ocr";
import { ocrPdfPages } from "./pdf-ocr";
import { storage } from "./storage";
import { buildTemplatePrompt } from "./document-validator";

export interface PdfExtractedEntry {
  patientName: string;
  patientBirthDate?: string;
  patientCpf?: string;
  procedureDate: string;
  procedureName?: string;
  insuranceProvider?: string;
  paymentMethod?: string;
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

PARA CADA REGISTRO, EXTRAIA ESTES 8 CAMPOS:

1. patientName (OBRIGATÓRIO): Nome do paciente/beneficiário/cliente.
   Pode estar em colunas como: "Paciente", "Beneficiário", "Cliente", "Nome", "Tomador"

2. procedureDate (OBRIGATÓRIO): Data do relatório/repasse no formato YYYY-MM-DD.
   ATENÇÃO: Esta é a data em que a clínica registrou o pagamento, pode ser diferente da data do procedimento.
   Pode estar em: "Data", "Dt. Atendimento", "Data Procedimento", "Competência"
   Se o relatório tem UMA data no cabeçalho para TODOS os registros, use essa data para todos.

3. procedureName: Nome/tipo do procedimento realizado.
   Pode estar em: "Procedimento", "Serviço", "Tipo", "Descrição", "Código"
   Se NÃO existir coluna de procedimento, use null — NÃO invente.

4. insuranceProvider: APENAS o convênio/plano de saúde — NÃO a forma de pagamento.
   REGRAS:
   - Se tem coluna "Convênio" com nome do plano (Unimed, Amil, SulAmérica, etc.) → use o nome
   - Se a coluna diz "SUS" ou "Sistema Único de Saúde" → use "SUS"
   - Se NÃO tem coluna de convênio separada → use "Particular"
   - NUNCA coloque PIX, Redecard, Dinheiro, Cartão, Pacote neste campo

5. paymentMethod: Forma de pagamento usada pela clínica.
   Pode estar em: "Espécie", "Repasse", "Forma Pgto", "Tipo"
   Exemplos: "PIX", "Dinheiro", "Redecard", "Cartão Crédito", "PACOTE", "Depósito", "Cheque"
   Códigos comuns: "PX"=PIX, "DN"=Dinheiro, "CC"=Cartão Crédito, "RE"=Redecard, "DP"=Depósito, "CH"=Cheque
   Se NÃO há forma de pagamento → use null

6. reportedValue: Valor financeiro em formato decimal com ponto.
   Pode estar em: "Valor", "Total", "Repasse", "Valor Pago", "Valor Líquido"
   CONVERSÃO DE VALORES BRASILEIROS:
   - "600,00" → "600.00"
   - "4.702,00" → "4702.00"
   - "1.000,00" → "1000.00"
   - "R$ 350,00" → "350.00"
   Se NÃO tem valor → use "0.00"

7. patientBirthDate: Data de nascimento no formato YYYY-MM-DD. Se não disponível → null

8. patientCpf: CPF do paciente no formato "000.000.000-00". Se não disponível → null

9. description: Observações/notas adicionais. Se não disponível → null

REGRAS IMPORTANTES:
- Extraia TODAS as linhas de pacientes, mesmo repetidas ou com dados parciais
- ATENÇÃO: Se o mesmo paciente aparece N vezes no mesmo dia (ex: pagou em parcelas, formas de pagamento diferentes) → extraia TODAS as N ocorrências separadamente com seus respectivos valores e formas de pagamento
- Ignore SEMPRE: cabeçalhos, rodapés, totais, subtotais, resumos
- Ignore linhas que começam com "Observação:" ou "Obs:" — NÃO são registros de pacientes
- Cada linha de paciente/transação é um registro ÚNICO — trate separadamente
- Se o documento tem múltiplas páginas, extraia de TODAS
- Se uma coluna não existe naquele formato → use null, NUNCA invente dados
- Em documentos "Conta Corrente": a coluna "Espécie" indica forma de pagamento (paymentMethod), NÃO convênio

Responda APENAS com um array JSON válido. Sem markdown, sem explicações, sem texto antes ou depois do JSON.`;

const MAX_PROCEDURE_VALUE = 500000;

function sanitizeValue(val: string | undefined | null): string {
  if (!val) return "0.00";
  let v = val.toString().replace(/[R$\s€£¥]/g, "").trim();
  // Brazilian format: 1.234,56 or 1.234 (dot as thousands, comma as decimal)
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(v)) {
    v = v.replace(/\./g, "").replace(",", ".");
  // US format: 1,234.56 or 1,234 (comma as thousands, dot as decimal)
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(v)) {
    v = v.replace(/,/g, "");
  } else {
    // Single comma as decimal separator: 1234,56
    v = v.replace(",", ".");
  }
  const num = parseFloat(v);
  if (isNaN(num) || num < 0) return "0.00";
  if (num > MAX_PROCEDURE_VALUE) return MAX_PROCEDURE_VALUE.toFixed(2);
  return num.toFixed(2);
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

function sanitizeCpf(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const digits = raw.toString().replace(/\D/g, "");
  if (digits.length !== 11) return undefined;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function sanitizeEntry(raw: any): PdfExtractedEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const name = (raw.patientName || raw.patient_name || raw.nome || raw.paciente || "").toString().trim();
  if (!name || name.length < 2) return null;

  const procDate = sanitizeDate(raw.procedureDate || raw.procedure_date || raw.data || raw.date);
  if (!procDate) return null;

  let insurance = (raw.insuranceProvider || raw.insurance_provider || raw.convenio || raw.convênio || raw.insurance || "").toString().trim();
  const procedure = (raw.procedureName || raw.procedure_name || raw.procedimento || raw.procedure || "").toString().trim();

  // paymentMethod is kept separately — never merged into insuranceProvider
  let paymentMethod = (raw.paymentMethod || raw.payment_method || raw.especie || raw.espécie || raw.repasse || raw.forma_pagamento || "").toString().trim() || undefined;

  // If insurance field accidentally contains a payment method, move it to paymentMethod
  if (isPaymentMethod(insurance)) {
    if (!paymentMethod) paymentMethod = insurance;
    insurance = "Particular";
  }
  if (isPaymentMethod(procedure) && !insurance) {
    insurance = "Particular";
  }

  return {
    patientName: name,
    patientBirthDate: sanitizeDate(raw.patientBirthDate || raw.patient_birth_date || raw.nascimento || raw.birthdate) || undefined,
    patientCpf: sanitizeCpf(raw.patientCpf || raw.patient_cpf || raw.cpf) || undefined,
    procedureDate: procDate,
    procedureName: procedure || undefined,
    insuranceProvider: insurance || undefined,
    paymentMethod: paymentMethod || undefined,
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

  console.log(`[PDF] Texto extraído: ${text.length} chars`);

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
      console.warn("AI returned 0 entries from non-empty PDF. Response length:", content.length);
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

// Portuguese particles that should be ignored when comparing names.
// "Maria de Souza" and "Maria Souza" refer to the same person.
const PT_PARTICLES = /\b(DE|DA|DO|DOS|DAS|E|D)\b/g;

function normalizeStr(s: string | null | undefined): string {
  return (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(PT_PARTICLES, "")        // remove particles
    .replace(/[^A-Z0-9\s]/g, "")     // keep only letters/digits/spaces
    .replace(/\s+/g, " ")             // collapse multiple spaces
    .trim();
}

// ── Value comparison ─────────────────────────────────────────────────────────
// Thresholds: both must exceed to trigger any action (avoids rounding noise).
const VALUE_PCT_THRESHOLD = 0.05; // 5 %
const VALUE_ABS_THRESHOLD = 10;   // R$ 10,00

function fmtBRL(v: number): string {
  return `R$\u00a0${v.toFixed(2).replace(".", ",")}`;
}

type ValueCheckResult =
  | { status: "ok"; reason: "" }
  | { status: "partial"; reason: string }   // clinic paid less  → might be installment
  | { status: "overpaid"; reason: string }; // clinic paid more  → real problem

/**
 * Compares the value the doctor registered vs what the clinic reported.
 *
 * Returns:
 *  "ok"      – values are close enough (within threshold); reconcile normally.
 *  "partial" – clinic paid significantly LESS than expected.
 *              Could be a valid installment payment — caller should reconcile
 *              but attach the reason as a matchDetails note, NOT as divergent.
 *  "overpaid"– clinic paid MORE than expected — genuine problem, caller should
 *              mark divergent.
 *
 * When the doctor did not register a value (null / zero) we skip the check
 * entirely ("ok") so that the system does not generate false positives.
 */
function checkValue(
  entryValue: string | null | undefined,
  reportedValue: string,
): ValueCheckResult {
  const ev = parseFloat(entryValue || "0");
  const rv = parseFloat(reportedValue || "0");

  if (!entryValue || ev <= 0 || rv <= 0) return { status: "ok", reason: "" };

  const diff = Math.abs(ev - rv);
  const pct = diff / Math.max(ev, rv);

  // Within tolerance → OK
  if (diff <= VALUE_ABS_THRESHOLD || pct <= VALUE_PCT_THRESHOLD) {
    return { status: "ok", reason: "" };
  }

  if (rv > ev) {
    // Clinic paid MORE than expected
    return {
      status: "overpaid",
      reason: `Valor acima do esperado: médico registrou ${fmtBRL(ev)}, clínica reportou ${fmtBRL(rv)} (${fmtBRL(rv - ev)} a mais)`,
    };
  }

  // Clinic paid LESS → may be a valid installment payment
  return {
    status: "partial",
    reason: `Pagamento parcial: recebido ${fmtBRL(rv)} de ${fmtBRL(ev)} esperados (${fmtBRL(ev - rv)} ainda pendente)`,
  };
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

  // ── CPF: strongest identifier — if both sides have it and it matches, override name check ──
  const entryCpfDigits = ((entry.patientCpf || entry.cpf) || "").replace(/\D/g, "");
  const reportCpfDigits = ((report.patientCpf || report.cpf) || "").replace(/\D/g, "");
  const hasCpfBoth = entryCpfDigits.length === 11 && reportCpfDigits.length === 11;
  const cpfMatch = hasCpfBoth && entryCpfDigits === reportCpfDigits;
  const cpfConflict = hasCpfBoth && !cpfMatch;

  if (hasCpfBoth) {
    filledFields++;
    if (cpfMatch) {
      score += 2; // CPF match gives 2 points — very strong signal
      matchedFields.push("cpf");
    } else {
      divergentFields.push(`CPF: "${entry.patientCpf || entry.cpf}" ≠ "${report.patientCpf || report.cpf}"`);
    }
  }

  // ── Patient name: primary text identifier ──
  const nameDistance = levenshteinDistance(entry.patientName, report.patientName);
  const nameLen = Math.max(normalizeStr(entry.patientName).length, normalizeStr(report.patientName).length);
  // If CPF matches, accept even minor name variation (typos); otherwise apply normal threshold
  const nameMatched = cpfMatch || (!cpfConflict && nameDistance <= nameMatchThreshold(nameLen));
  filledFields++;
  if (nameMatched) {
    score++;
    matchedFields.push("nome");
  } else {
    divergentFields.push(`Nome: "${entry.patientName}" ≠ "${report.patientName}"`);
  }

  // ── Birth date: secondary identifier / disambiguator ──
  // Only used when multiple entries exist for the same patient name
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

  // NOTE: Date is intentionally NOT compared.
  // Entry date = procedure date (when the doctor performed it).
  // Report date = payment/repasse date (when the clinic paid, weeks/months later).
  // These are fundamentally different concepts and will almost never match.

  // NOTE: Insurance/convenio is intentionally NOT compared.
  // Doctor records the plan name (e.g. "Particular", "SUS", "Unimed").
  // Clinic records the payment method (e.g. "REDECARD", "PIX", "PACOTE").
  // These are different dimensions of the same event and should not be cross-compared.

  // ── Value proximity: used as tiebreaker when multiple candidates match by name ──
  // Not a disqualifier here — value divergence is applied separately after match.
  const entryVal = parseFloat((entry.procedureValue || "0"));
  const reportVal = parseFloat((report.reportedValue || "0"));
  if (entryVal > 0 && reportVal > 0) {
    filledFields++;
    const diff = Math.abs(entryVal - reportVal) / Math.max(entryVal, reportVal);
    if (diff <= VALUE_PCT_THRESHOLD) {
      score++;
      matchedFields.push("valor");
    }
    // No divergentFields here — value divergence is a post-match check, not a blocker
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

CONTEXTO IMPORTANTE:
- O médico lança procedimentos na DATA EM QUE ATENDEU o paciente (data do procedimento).
- A clínica gera relatórios na DATA EM QUE PAGOU o médico (data de repasse), que pode ser semanas ou meses depois.
- O médico lança o PLANO/CONVÊNIO do paciente (ex: Particular, SUS, Unimed).
- A clínica registra a FORMA DE PAGAMENTO (ex: PIX, REDECARD, PACOTE).
- PORTANTO: datas e convênios SEMPRE vão ser diferentes entre médico e clínica — isso é NORMAL e esperado.

REGRA PRINCIPAL: O matching é feito pelo NOME DO PACIENTE (e CPF quando disponível).
Procure na lista da clínica um paciente com nome igual ou similar. NÃO use posição na lista.

PROCESSO:
1. Para cada lançamento do médico, PROCURE pelo CPF (se disponível) ou NOME na lista da clínica
2. Se encontrar match por CPF → status "received" (match certo, independente do nome)
3. Se encontrar nome similar (variações de grafia são aceitas):
   - Valide APENAS a data de nascimento (se disponível nos dois lados)
   - NÃO compare datas de procedimento (são datas de conceitos diferentes)
   - NÃO compare convênio com forma de pagamento (são conceitos diferentes)
4. Determine o status:
   - "received": Nome encontrado (ou CPF matched) e dados de nascimento batem (ou não disponíveis)
   - "divergent": Nome encontrado MAS data de nascimento disponível nos dois lados e DIFERENTE
   - "pending": Nome NÃO encontrado na lista da clínica

REGRAS DE DIVERGÊNCIA (revisadas):
- CPF match → sempre "received" (é um identificador único)
- Divergência de DATA DE NASCIMENTO → "divergent" (pode indicar homônimo)
- Diferença de DATA DO PROCEDIMENTO → NÃO é divergência (datas são de conceitos diferentes)
- Diferença de CONVÊNIO/FORMA DE PAGAMENTO → NÃO é divergência (são conceitos diferentes)
- VALOR: analise o valorRegistrado (médico) vs valor da clínica:
  • Clínica pagou MAIS que o esperado (>5% E >R$10 acima) → "divergent" com reason "Valor acima do esperado"
  • Clínica pagou MENOS que o esperado → "received" normalmente (pode ser parcela/entrada de um parcelamento — o sistema trata automaticamente)
  • Diferença pequena (≤5% ou ≤R$10) → "received" normalmente (taxas, arredondamentos)
- Se o paciente aparece mais de uma vez na clínica, prefira aquele com data de nascimento igual e/ou valor mais próximo
- NUNCA faça match por posição na lista — sempre por nome ou CPF

Responda com um array JSON:
[{"entryIndex": 0, "reportIndex": 3, "status": "received", "divergenceReason": null}, ...]

entryIndex = índice do lançamento do médico (0-based)
reportIndex = índice do registro da clínica que corresponde (0-based), ou null se não encontrado
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
    cpf: e.patientCpf || e.cpf || null,
    nascimento: e.patientBirthDate || "N/D",
    valorRegistrado: e.procedureValue ? parseFloat(e.procedureValue) : null,
  }));

  const reportSummary = reports.map((r, i) => ({
    idx: i,
    nome: r.patientName,
    cpf: r.patientCpf || null,
    nascimento: r.patientBirthDate || "N/D",
    valor: r.reportedValue,
    formaPagamento: r.paymentMethod || r.insuranceProvider || "N/D",
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

/**
 * Groups clinic report entries for the same patient on the same date.
 * This handles installment payments: a patient pays in multiple ways on the same day
 * (e.g. R$300 cash + R$400 credit + R$300 debit = R$1000 total).
 *
 * Returns the first report of each group as the "representative" (used for matching),
 * plus a map of reportId → all sibling report IDs in the same installment group.
 */
function groupInstallmentReports(reports: any[]): {
  grouped: any[];
  installmentMap: Map<string, string[]>;
} {
  const installmentMap = new Map<string, string[]>();
  const seenGroups = new Map<string, string>(); // groupKey → representativeId
  const grouped: any[] = [];

  for (const report of reports) {
    if (report.matched) continue;
    const namePart = normalizeStr(report.patientName);
    const cpfPart = ((report.patientCpf || "").replace(/\D/g, "") || namePart);
    // Use UTC date parts to avoid timezone shifting (procedureDate may include time component)
    const d = new Date(report.procedureDate);
    const datePart = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    // Include the procedure name (truncated) so that two different procedures for
    // the same patient/date are NOT merged into one installment group.
    // When procedureName is absent on both sides (common), they are still grouped normally.
    const procPart = normalizeStr(report.procedureName || "").slice(0, 20);
    const groupKey = `${cpfPart}|${datePart}|${procPart}`;

    if (seenGroups.has(groupKey)) {
      const representativeId = seenGroups.get(groupKey)!;
      const siblings = installmentMap.get(representativeId) || [];
      siblings.push(report.id);
      installmentMap.set(representativeId, siblings);
      // Add installment value to the representative
      const rep = grouped.find(r => r.id === representativeId);
      if (rep) {
        const repVal = parseFloat(rep.reportedValue || "0") || 0;
        const addVal = parseFloat(report.reportedValue || "0") || 0;
        rep.reportedValue = (repVal + addVal).toFixed(2);
        rep._installmentCount = (rep._installmentCount || 1) + 1;
        rep._paymentMethods = [
          ...(rep._paymentMethods || [rep.paymentMethod || rep.insuranceProvider]),
          report.paymentMethod || report.insuranceProvider,
        ].filter(Boolean);
      }
    } else {
      seenGroups.set(groupKey, report.id);
      installmentMap.set(report.id, []);
      const repReport = { ...report, _installmentCount: 1, _paymentMethods: [report.paymentMethod || report.insuranceProvider].filter(Boolean) };
      grouped.push(repReport);
    }
  }

  return { grouped, installmentMap };
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

  // Group installment payments: same patient, same day → sum their values into one representative
  const { grouped: groupedReports, installmentMap } = groupInstallmentReports(unmatchedReports);

  const usedReports = new Set<string>();
  const statusUpdates: Array<{ id: string; status: string; matchedReportId?: string | null; divergenceReason?: string | null; matchConfidence?: number | null }> = [];
  const reportMatchUpdates: Array<{ reportId: string; entryId: string }> = [];

  const markReportGroupUsed = (representativeId: string, entryId: string) => {
    usedReports.add(representativeId);
    reportMatchUpdates.push({ reportId: representativeId, entryId });
    // Also mark all sibling installment reports as matched to the same entry
    const siblings = installmentMap.get(representativeId) || [];
    for (const sibId of siblings) {
      usedReports.add(sibId);
      reportMatchUpdates.push({ reportId: sibId, entryId });
    }
  };

  for (let batchStart = 0; batchStart < pendingEntries.length; batchStart += AI_BATCH_SIZE) {
    const entryBatch = pendingEntries.slice(batchStart, batchStart + AI_BATCH_SIZE);

    // Narrow reports to a ±90-day window around this batch's date range.
    // This prevents sending 200 stale reports to the AI when a user uploads a new month.
    const batchDates = entryBatch.map(e => new Date(e.procedureDate).getTime()).filter(t => !isNaN(t));
    const batchMin = batchDates.length ? Math.min(...batchDates) : 0;
    const batchMax = batchDates.length ? Math.max(...batchDates) : Infinity;
    const windowMs = 90 * 24 * 60 * 60 * 1000; // 90 days
    const availableReports = groupedReports.filter(r => {
      if (usedReports.has(r.id)) return false;
      const rt = new Date(r.procedureDate).getTime();
      return isNaN(rt) || (rt >= batchMin - windowMs && rt <= batchMax + windowMs);
    });
    if (availableReports.length === 0) break;

    const aiResults = await aiReconciliationBatch(entryBatch, availableReports, batchStart);

    for (const aiMatch of aiResults) {
      const entry = pendingEntries[aiMatch.entryIndex];
      if (!entry) continue;

      if (aiMatch.reportIndex !== null && aiMatch.reportIndex !== undefined) {
        const report = availableReports[aiMatch.reportIndex];
        if (!report || usedReports.has(report.id)) continue;

        // Safety check: reject if AI matched by position rather than name/CPF
        const entryCpf = ((entry.patientCpf || (entry as any).cpf) || "").replace(/\D/g, "");
        const reportCpf = ((report.patientCpf) || "").replace(/\D/g, "");
        const isCpfMatch = entryCpf.length === 11 && reportCpf.length === 11 && entryCpf === reportCpf;

        if (!isCpfMatch) {
          const entryNameNorm = normalizeStr(entry.patientName);
          const reportNameNorm = normalizeStr(report.patientName);
          const nameCheck = levenshteinDistance(entryNameNorm, reportNameNorm);
          const safetyLen = Math.max(entryNameNorm.length, reportNameNorm.length);
          const safetyLimit = nameMatchThreshold(safetyLen) + 2;
          if (nameCheck > safetyLimit) {
            console.log(`[Reconciliation] AI positional match rejeitado (distância=${nameCheck}, limite=${safetyLimit})`);
            continue;
          }
        }

        const aiConfidence = computeAiMatchConfidence(entry, report);
        const installmentNote = (report._installmentCount || 1) > 1
          ? ` (${report._installmentCount} parcelas: ${(report._paymentMethods || []).join(", ")})`
          : "";

        if (aiMatch.status === "received") {
          const vc = checkValue(entry.procedureValue, report.reportedValue);
          if (vc.status === "overpaid") {
            // Clinic paid MORE than expected → real problem
            result.divergent.push({
              entryId: entry.id, reportId: report.id,
              patientName: entry.patientName, procedureDate: entry.procedureDate.toISOString(),
              entryValue: entry.procedureValue, reportValue: report.reportedValue,
              divergenceReason: vc.reason + (installmentNote ? ` ${installmentNote}` : ""),
            });
            statusUpdates.push({ id: entry.id, status: "divergent", matchedReportId: report.id, divergenceReason: vc.reason, matchConfidence: aiConfidence });
          } else {
            // "ok" or "partial" → reconciled; partial note is informational only
            const note = [installmentNote, vc.status === "partial" ? vc.reason : ""].filter(Boolean).join(" | ");
            result.reconciled.push({
              entryId: entry.id, reportId: report.id,
              patientName: entry.patientName, procedureDate: entry.procedureDate.toISOString(),
              entryValue: entry.procedureValue, reportValue: report.reportedValue,
              matchDetails: note || undefined,
            });
            statusUpdates.push({ id: entry.id, status: "reconciled", matchedReportId: report.id, divergenceReason: null, matchConfidence: aiConfidence });
          }
          markReportGroupUsed(report.id, entry.id);
        } else if (aiMatch.status === "divergent") {
          const vc = checkValue(entry.procedureValue, report.reportedValue);
          const reason = [aiMatch.divergenceReason || "Dados parcialmente diferentes", vc.status !== "ok" ? vc.reason : ""].filter(Boolean).join("; ");
          result.divergent.push({
            entryId: entry.id, reportId: report.id,
            patientName: entry.patientName, procedureDate: entry.procedureDate.toISOString(),
            entryValue: entry.procedureValue, reportValue: report.reportedValue,
            divergenceReason: reason,
          });
          statusUpdates.push({ id: entry.id, status: "divergent", matchedReportId: report.id, divergenceReason: reason, matchConfidence: aiConfidence });
          markReportGroupUsed(report.id, entry.id);
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

    const entryTime = new Date(entry.procedureDate).getTime();
    const windowMs90 = 90 * 24 * 60 * 60 * 1000;

    let bestMatch: MatchScore | null = null;
    for (const report of groupedReports) {
      if (usedReports.has(report.id)) continue;
      // Skip reports outside ±90-day window (same optimisation as AI batch)
      const rt = new Date(report.procedureDate).getTime();
      if (!isNaN(entryTime) && !isNaN(rt) && Math.abs(rt - entryTime) > windowMs90) continue;
      const ms = scoreMatch(entry, report);
      if (!ms.nameMatched) continue;
      if (!bestMatch || ms.score > bestMatch.score) {
        bestMatch = ms;
      }
    }

    // With new scoring: nameMatched = true is enough to reconcile (no date/insurance needed)
    // Divergent only if name matches but birth date conflicts
    if (bestMatch && bestMatch.nameMatched) {
      const hasBirthConflict = bestMatch.divergentFields.some(f => f.startsWith("Nascimento"));
      const installmentNote = (bestMatch.report._installmentCount || 1) > 1
        ? ` (${bestMatch.report._installmentCount} parcelas: ${(bestMatch.report._paymentMethods || []).join(", ")})`
        : "";

      const vc = checkValue(entry.procedureValue, bestMatch.report.reportedValue);
      const isDivergent = hasBirthConflict || vc.status === "overpaid";
      if (!isDivergent) {
        const note = [bestMatch.matchedFields.join(", ") + installmentNote, vc.status === "partial" ? vc.reason : ""].filter(Boolean).join(" | ");
        result.reconciled.push({
          entryId: entry.id,
          reportId: bestMatch.report.id,
          patientName: entry.patientName,
          procedureDate: entry.procedureDate.toISOString(),
          entryValue: entry.procedureValue,
          reportValue: bestMatch.report.reportedValue,
          matchDetails: note || undefined,
        });
        statusUpdates.push({ id: entry.id, status: "reconciled", matchedReportId: bestMatch.report.id, divergenceReason: null, matchConfidence: bestMatch.confidence });
        markReportGroupUsed(bestMatch.report.id, entry.id);
      } else {
        const reasons = [
          hasBirthConflict ? bestMatch.divergentFields.join("; ") : "",
          vc.status !== "ok" ? vc.reason : "",
        ].filter(Boolean).join("; ");
        result.divergent.push({
          entryId: entry.id,
          reportId: bestMatch.report.id,
          patientName: entry.patientName,
          procedureDate: entry.procedureDate.toISOString(),
          entryValue: entry.procedureValue,
          reportValue: bestMatch.report.reportedValue,
          divergenceReason: reasons,
        });
        statusUpdates.push({ id: entry.id, status: "divergent", matchedReportId: bestMatch.report.id, divergenceReason: reasons, matchConfidence: bestMatch.confidence });
        markReportGroupUsed(bestMatch.report.id, entry.id);
      }
    } else {
      result.pending.push({
        entryId: entry.id,
        patientName: entry.patientName,
        procedureDate: entry.procedureDate.toISOString(),
        entryValue: entry.procedureValue,
      });
    }
  }

  for (const report of groupedReports) {
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
