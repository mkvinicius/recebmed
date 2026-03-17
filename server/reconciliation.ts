import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import { getOpenAIClient } from "./openai";
import { storage } from "./storage";

export interface PdfExtractedEntry {
  patientName: string;
  patientBirthDate?: string;
  procedureDate: string;
  procedureName?: string;
  insuranceProvider?: string;
  reportedValue: string;
  description?: string;
}

const EXTRACTION_PROMPT = `Você é um assistente especializado em extrair dados de relatórios de clínicas médicas e hospitais brasileiros.
Analise o conteúdo e extraia TODOS os registros de pacientes/procedimentos encontrados.

IMPORTANTE: Esses PDFs podem vir em vários formatos:
- Relatórios tabulares de hospitais (ex: "Conta Corrente Equipe Médica" com colunas Data, Paciente, Valor, etc.)
- Guias TISS de convênios
- Extratos de produção médica
- Notas fiscais de serviços médicos

Para cada registro/linha de paciente, extraia:
- patientName: nome completo do paciente (OBRIGATÓRIO)
- patientBirthDate: data de nascimento no formato YYYY-MM-DD (se disponível, senão null)
- procedureDate: data do procedimento/atendimento no formato YYYY-MM-DD (OBRIGATÓRIO)
- procedureName: nome do procedimento, espécie de pagamento ou tipo de serviço (se disponível)
- insuranceProvider: nome do convênio/plano de saúde. Se for pagamento particular (PIX, Dinheiro, Cartão, Redecard, etc.), use "Particular"
- reportedValue: valor em formato decimal com ponto (ex: "600.00"). Converta valores brasileiros: "1.000,00" → "1000.00", "600,00" → "600.00"
- description: observações adicionais (se disponível)

REGRAS:
- Extraia TODAS as linhas, mesmo que tenham dados repetidos ou parciais
- Ignore linhas de cabeçalho, totais e rodapé
- Se o mesmo paciente aparece múltiplas vezes com valores diferentes, extraia cada ocorrência separadamente
- Valores com formato brasileiro (vírgula decimal, ponto milhar) devem ser convertidos: "4.702,00" → "4702.00"

Responda APENAS com um array JSON válido, sem markdown, sem explicações.`;

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

function sanitizeEntry(raw: any): PdfExtractedEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const name = (raw.patientName || raw.patient_name || raw.nome || raw.paciente || "").toString().trim();
  if (!name || name.length < 2) return null;

  const procDate = sanitizeDate(raw.procedureDate || raw.procedure_date || raw.data || raw.date);
  if (!procDate) return null;

  return {
    patientName: name,
    patientBirthDate: sanitizeDate(raw.patientBirthDate || raw.patient_birth_date || raw.nascimento || raw.birthdate) || undefined,
    procedureDate: procDate,
    procedureName: (raw.procedureName || raw.procedure_name || raw.procedimento || raw.procedure || "").toString().trim() || undefined,
    insuranceProvider: (raw.insuranceProvider || raw.insurance_provider || raw.convenio || raw.convênio || raw.insurance || "").toString().trim() || undefined,
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

export async function extractPdfData(pdfBuffer: Buffer): Promise<PdfExtractedEntry[]> {
  let text: string;
  try {
    const pdfData = await pdfParse(pdfBuffer);
    text = pdfData.text;
  } catch (pdfErr) {
    console.error("PDF parse error:", pdfErr);
    throw new Error("Não foi possível ler o PDF. O arquivo pode estar corrompido ou protegido por senha.");
  }

  if (!text || text.trim().length < 20) {
    throw new Error("O PDF não contém texto extraível. Tente enviar como imagem (foto/screenshot).");
  }

  console.log(`PDF text extracted: ${text.length} chars, first 200: ${text.substring(0, 200)}`);

  const client = getOpenAIClient();
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Texto extraído do PDF do relatório da clínica:\n\n${text}` },
      ],
      max_completion_tokens: 16000,
    });

    const content = response.choices[0]?.message?.content || "[]";
    const results = parseAIResponse(content);
    console.log(`PDF AI extraction: ${results.length} entries from ${text.length} chars`);

    if (results.length === 0 && text.length > 100) {
      console.warn("AI returned 0 entries from non-empty PDF. Response:", content.substring(0, 500));
    }

    return results;
  } catch (aiErr: any) {
    console.error("AI extraction error:", aiErr?.message || aiErr);
    if (aiErr?.status === 429 || aiErr?.message?.includes("rate")) {
      throw new Error("Limite de requisições atingido. Aguarde alguns segundos e tente novamente.");
    }
    throw new Error("Erro na extração com IA. Tente novamente em alguns instantes.");
  }
}

export async function extractImageData(base64Image: string): Promise<PdfExtractedEntry[]> {
  const client = getOpenAIClient();
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
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
      max_completion_tokens: 16000,
    });

    const content = response.choices[0]?.message?.content || "[]";
    const results = parseAIResponse(content);
    console.log(`Image AI extraction: ${results.length} entries`);
    return results;
  } catch (aiErr: any) {
    console.error("Image AI extraction error:", aiErr?.message || aiErr);
    if (aiErr?.status === 429 || aiErr?.message?.includes("rate")) {
      throw new Error("Limite de requisições atingido. Aguarde alguns segundos e tente novamente.");
    }
    throw new Error("Erro na extração da imagem com IA. Tente novamente em alguns instantes.");
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
  const client = getOpenAIClient();
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Conteúdo de planilha CSV/Excel exportada de sistema de clínica. Identifique as colunas automaticamente e extraia os registros:\n\n${preview}` },
      ],
      max_completion_tokens: 16000,
    });
    const results = parseAIResponse(response.choices[0]?.message?.content || "[]");
    console.log(`CSV AI fallback extraction: ${results.length} entries`);
    return results;
  } catch (aiErr: any) {
    console.error("CSV AI extraction error:", aiErr?.message || aiErr);
    throw new Error("Não foi possível interpretar o formato da planilha. Tente usar o modelo CSV padrão.");
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
}

interface MatchScore {
  report: any;
  score: number;
  totalFields: number;
  matchedFields: string[];
  divergentFields: string[];
}

function scoreMatch(entry: any, report: any): MatchScore {
  let score = 0;
  const totalFields = 5;
  const matchedFields: string[] = [];
  const divergentFields: string[] = [];

  const nameDistance = levenshteinDistance(entry.patientName, report.patientName);
  if (nameDistance <= 3) {
    score++;
    matchedFields.push("nome");
  } else {
    divergentFields.push(`Nome: "${entry.patientName}" ≠ "${report.patientName}"`);
  }

  const entryDate = new Date(entry.procedureDate);
  const reportDate = new Date(report.procedureDate);
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
    if (entryBirth === reportBirth) {
      score++;
      matchedFields.push("nascimento");
    } else {
      divergentFields.push(`Nascimento: ${entry.patientBirthDate} ≠ ${report.patientBirthDate}`);
    }
  } else {
    matchedFields.push("nascimento");
    score++;
  }

  const entryProc = normalizeStr(entry.procedureName || entry.description);
  const reportProc = normalizeStr(report.procedureName || report.description);
  if (entryProc && reportProc) {
    const procDistance = levenshteinDistance(entryProc, reportProc);
    const maxLen = Math.max(entryProc.length, reportProc.length);
    if (procDistance <= Math.ceil(maxLen * 0.3) || entryProc.includes(reportProc) || reportProc.includes(entryProc)) {
      score++;
      matchedFields.push("procedimento");
    } else {
      divergentFields.push(`Procedimento: "${entry.procedureName || entry.description}" ≠ "${report.procedureName || report.description}"`);
    }
  } else {
    matchedFields.push("procedimento");
    score++;
  }

  const entryIns = normalizeStr(entry.insuranceProvider);
  const reportIns = normalizeStr(report.insuranceProvider);
  if (entryIns && reportIns) {
    const insDistance = levenshteinDistance(entryIns, reportIns);
    if (insDistance <= 3 || entryIns.includes(reportIns) || reportIns.includes(entryIns)) {
      score++;
      matchedFields.push("convênio");
    } else {
      divergentFields.push(`Convênio: "${entry.insuranceProvider}" ≠ "${report.insuranceProvider}"`);
    }
  } else {
    matchedFields.push("convênio");
    score++;
  }

  return { report, score, totalFields, matchedFields, divergentFields };
}

const AI_RECONCILIATION_PROMPT = `Você é um assistente de conferência médica. Analise os lançamentos do médico e os registros da clínica.
Para cada lançamento do médico, determine o melhor match no relatório da clínica comparando:
1. Nome do paciente (pode ter variações de grafia)
2. Data de atendimento (pode ter pequenas diferenças)
3. Data de nascimento do paciente (se disponível)
4. Procedimento realizado
5. Convênio/plano de saúde

Para cada lançamento, responda com:
- entryIndex: índice do lançamento do médico (0-based)
- reportIndex: índice do relatório da clínica que melhor corresponde (0-based), ou null se nenhum
- status: "received" (dados batem), "divergent" (match parcial, algo diferente), ou "pending" (não encontrado)
- divergenceReason: explicação em português do que está diferente (apenas se divergent)

NÃO compare valores financeiros. Foque apenas nos 5 campos acima.
Responda APENAS com um array JSON válido, sem markdown.`;

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
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: AI_RECONCILIATION_PROMPT },
        { role: "user", content: `Lançamentos do médico (${entries.length}):\n${JSON.stringify(entrySummary)}\n\nRelatório da clínica (${reports.length}):\n${JSON.stringify(reportSummary)}` },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || "[]";
    const cleaned = content.replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.map((r: any) => ({ ...r, entryIndex: r.entryIndex + entryOffset })) : [];
  } catch (err) {
    console.error("AI reconciliation batch error:", err);
    return [];
  }
}

export async function runReconciliation(doctorId: string): Promise<ReconciliationResult> {
  const pendingEntries = await storage.getPendingDoctorEntries(doctorId);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const reports = await storage.getRecentClinicReports(doctorId, twoYearsAgo);

  const result: ReconciliationResult = {
    reconciled: [],
    divergent: [],
    pending: [],
  };

  if (pendingEntries.length === 0) return result;
  if (reports.length === 0) {
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
  const statusUpdates: Array<{ id: string; status: string }> = [];

  for (let batchStart = 0; batchStart < pendingEntries.length; batchStart += AI_BATCH_SIZE) {
    const entryBatch = pendingEntries.slice(batchStart, batchStart + AI_BATCH_SIZE);
    const availableReports = reports.filter(r => !usedReports.has(r.id));
    if (availableReports.length === 0) break;

    const aiResults = await aiReconciliationBatch(entryBatch, availableReports, batchStart);

    for (const aiMatch of aiResults) {
      const entry = pendingEntries[aiMatch.entryIndex];
      if (!entry) continue;

      if (aiMatch.status === "received" && aiMatch.reportIndex !== null && aiMatch.reportIndex !== undefined) {
        const report = availableReports[aiMatch.reportIndex];
        if (report && !usedReports.has(report.id)) {
          usedReports.add(report.id);
          result.reconciled.push({
            entryId: entry.id,
            reportId: report.id,
            patientName: entry.patientName,
            procedureDate: entry.procedureDate.toISOString(),
            entryValue: entry.procedureValue,
            reportValue: report.reportedValue,
          });
          statusUpdates.push({ id: entry.id, status: "reconciled" });
        }
      } else if (aiMatch.status === "divergent" && aiMatch.reportIndex !== null && aiMatch.reportIndex !== undefined) {
        const report = availableReports[aiMatch.reportIndex];
        if (report && !usedReports.has(report.id)) {
          usedReports.add(report.id);
          result.divergent.push({
            entryId: entry.id,
            reportId: report.id,
            patientName: entry.patientName,
            procedureDate: entry.procedureDate.toISOString(),
            entryValue: entry.procedureValue,
            reportValue: report.reportedValue,
            divergenceReason: aiMatch.divergenceReason || "Dados parcialmente diferentes",
          });
          statusUpdates.push({ id: entry.id, status: "divergent" });
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
    for (const report of reports) {
      if (usedReports.has(report.id)) continue;
      const ms = scoreMatch(entry, report);
      if (!bestMatch || ms.score > bestMatch.score) {
        bestMatch = ms;
      }
    }

    if (bestMatch && bestMatch.score >= 4) {
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
      statusUpdates.push({ id: entry.id, status: "reconciled" });
    } else if (bestMatch && bestMatch.score >= 2) {
      usedReports.add(bestMatch.report.id);
      result.divergent.push({
        entryId: entry.id,
        reportId: bestMatch.report.id,
        patientName: entry.patientName,
        procedureDate: entry.procedureDate.toISOString(),
        entryValue: entry.procedureValue,
        reportValue: bestMatch.report.reportedValue,
        divergenceReason: bestMatch.divergentFields.join("; "),
      });
      statusUpdates.push({ id: entry.id, status: "divergent" });
    } else {
      result.pending.push({
        entryId: entry.id,
        patientName: entry.patientName,
        procedureDate: entry.procedureDate.toISOString(),
        entryValue: entry.procedureValue,
      });
    }
  }

  if (statusUpdates.length > 0) {
    await storage.batchUpdateDoctorEntryStatus(statusUpdates);
  }

  const verifiedTotal = result.reconciled.length + result.divergent.length;
  await storage.createNotification({
    doctorId,
    type: "reconciliation",
    title: "Conferência concluída",
    message: `${verifiedTotal} conferidos (${result.reconciled.length} recebidos, ${result.divergent.length} divergentes), ${result.pending.length} pendentes`,
    read: false,
  });

  return result;
}
