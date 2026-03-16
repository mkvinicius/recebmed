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

const EXTRACTION_PROMPT = `Você é um assistente especializado em extrair dados de relatórios de clínicas médicas.
Analise o conteúdo e extraia TODOS os registros de pacientes/procedimentos encontrados.
Para cada registro, extraia:
- patientName: nome completo do paciente
- patientBirthDate: data de nascimento do paciente no formato YYYY-MM-DD (se disponível)
- procedureDate: data do procedimento/atendimento no formato YYYY-MM-DD
- procedureName: nome do procedimento realizado (consulta, cirurgia, exame, etc.)
- insuranceProvider: nome do convênio/plano de saúde (se disponível)
- reportedValue: valor reportado do procedimento (apenas números com ponto decimal, ex: "150.00")
- description: observações adicionais (se disponível)

Responda APENAS com um array JSON válido, sem markdown, sem explicações.
Se não conseguir identificar algum campo, use null.
Se o valor não for encontrado, use "0.00".`;

function parseAIResponse(content: string): PdfExtractedEntry[] {
  try {
    const cleaned = content.replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch {
    return [];
  }
}

export async function extractPdfData(pdfBuffer: Buffer): Promise<PdfExtractedEntry[]> {
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text;

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: `Texto extraído do PDF do relatório da clínica:\n\n${text}` },
    ],
    max_completion_tokens: 4000,
  });

  return parseAIResponse(response.choices[0]?.message?.content || "[]");
}

export async function extractImageData(base64Image: string): Promise<PdfExtractedEntry[]> {
  const client = getOpenAIClient();
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
    max_completion_tokens: 4000,
  });

  return parseAIResponse(response.choices[0]?.message?.content || "[]");
}

export function extractCsvData(csvText: string): PdfExtractedEntry[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const separator = headerLine.includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const patientIdx = headers.findIndex(h => ["paciente", "patient", "patientname", "patient_name", "nome", "nome_paciente", "nome do paciente"].includes(h));
  const dateIdx = headers.findIndex(h => ["data", "date", "proceduredate", "procedure_date", "data_procedimento", "data do procedimento", "data_atendimento", "data atendimento"].includes(h));
  const birthIdx = headers.findIndex(h => ["nascimento", "data_nascimento", "data de nascimento", "birth", "birthdate", "birth_date", "dt_nascimento"].includes(h));
  const procedureIdx = headers.findIndex(h => ["procedimento", "procedure", "procedurename", "procedure_name", "nome_procedimento"].includes(h));
  const insuranceIdx = headers.findIndex(h => ["convenio", "convênio", "insurance", "insuranceprovider", "insurance_provider", "plano", "operadora"].includes(h));
  const descIdx = headers.findIndex(h => ["descricao", "descrição", "description", "observacao", "observação", "obs"].includes(h));
  const valueIdx = headers.findIndex(h => ["valor", "value", "reportedvalue", "reported_value", "valor_reportado", "valor reportado", "preco", "preço", "price"].includes(h));

  if (patientIdx === -1 || dateIdx === -1) return [];

  const results: PdfExtractedEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ""));
    const patientName = cols[patientIdx] || "";
    if (!patientName) continue;

    let procedureDate = cols[dateIdx] || "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(procedureDate)) {
      const [d, m, y] = procedureDate.split("/");
      procedureDate = `${y}-${m}-${d}`;
    }

    let patientBirthDate: string | undefined;
    if (birthIdx >= 0 && cols[birthIdx]) {
      patientBirthDate = cols[birthIdx];
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(patientBirthDate)) {
        const [d, m, y] = patientBirthDate.split("/");
        patientBirthDate = `${y}-${m}-${d}`;
      }
    }

    let reportedValue = cols[valueIdx] || "0.00";
    reportedValue = reportedValue.replace(/[R$\s]/g, "").replace(",", ".");

    results.push({
      patientName,
      patientBirthDate,
      procedureDate,
      procedureName: procedureIdx >= 0 ? cols[procedureIdx] : undefined,
      insuranceProvider: insuranceIdx >= 0 ? cols[insuranceIdx] : undefined,
      reportedValue,
      description: descIdx >= 0 ? cols[descIdx] : undefined,
    });
  }
  return results;
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

async function aiReconciliation(entries: any[], reports: any[]): Promise<Array<{ entryIndex: number; reportIndex: number | null; status: string; divergenceReason?: string }>> {
  if (entries.length === 0) return [];

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
        { role: "user", content: `Lançamentos do médico:\n${JSON.stringify(entrySummary, null, 1)}\n\nRelatório da clínica:\n${JSON.stringify(reportSummary, null, 1)}` },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || "[]";
    const cleaned = content.replace(/```json\s*|```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("AI reconciliation fallback to local matching:", err);
    return [];
  }
}

export async function runReconciliation(doctorId: string): Promise<ReconciliationResult> {
  const pendingEntries = await storage.getPendingDoctorEntries(doctorId);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const reports = await storage.getRecentClinicReports(doctorId, sixtyDaysAgo);

  const result: ReconciliationResult = {
    reconciled: [],
    divergent: [],
    pending: [],
  };

  if (pendingEntries.length === 0) return result;

  const usedReports = new Set<string>();
  const statusUpdates: Array<{ id: string; status: string }> = [];

  let aiResults: Array<{ entryIndex: number; reportIndex: number | null; status: string; divergenceReason?: string }> = [];
  if (reports.length > 0) {
    aiResults = await aiReconciliation(pendingEntries, reports);
  }

  if (aiResults.length > 0) {
    for (const aiMatch of aiResults) {
      const entry = pendingEntries[aiMatch.entryIndex];
      if (!entry) continue;

      if (aiMatch.status === "received" && aiMatch.reportIndex !== null && aiMatch.reportIndex !== undefined) {
        const report = reports[aiMatch.reportIndex];
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
        const report = reports[aiMatch.reportIndex];
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
      } else {
        result.pending.push({
          entryId: entry.id,
          patientName: entry.patientName,
          procedureDate: entry.procedureDate.toISOString(),
          entryValue: entry.procedureValue,
        });
      }
    }
  }

  const processedEntryIds = new Set([
    ...result.reconciled.map(r => r.entryId),
    ...result.divergent.map(r => r.entryId),
    ...result.pending.map(r => r.entryId),
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
