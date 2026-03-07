import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import { getOpenAIClient } from "./openai";
import { storage } from "./storage";

export interface PdfExtractedEntry {
  patientName: string;
  procedureDate: string;
  reportedValue: string;
  description?: string;
}

const EXTRACTION_PROMPT = `Você é um assistente especializado em extrair dados de relatórios financeiros de clínicas médicas.
Analise o conteúdo e extraia TODOS os registros de pacientes/procedimentos encontrados.
Para cada registro, extraia:
- patientName: nome completo do paciente
- procedureDate: data do procedimento no formato YYYY-MM-DD
- reportedValue: valor reportado do procedimento (apenas números com ponto decimal, ex: "150.00")
- description: descrição do procedimento (se disponível)

Responda APENAS com um array JSON válido, sem markdown, sem explicações.
Se não conseguir identificar algum campo, use "Não identificado" como valor.
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

export interface CsvExtractedEntry extends PdfExtractedEntry {
  insuranceProvider?: string;
}

export function extractCsvData(csvText: string): CsvExtractedEntry[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const separator = headerLine.includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const patientIdx = headers.findIndex(h => ["paciente", "patient", "patientname", "patient_name", "nome", "nome_paciente", "nome do paciente"].includes(h));
  const dateIdx = headers.findIndex(h => ["data", "date", "proceduredate", "procedure_date", "data_procedimento", "data do procedimento"].includes(h));
  const insuranceIdx = headers.findIndex(h => ["convenio", "convênio", "insurance", "insuranceprovider", "insurance_provider", "plano", "operadora"].includes(h));
  const descIdx = headers.findIndex(h => ["procedimento", "procedure", "descricao", "descrição", "description", "observacao", "observação"].includes(h));
  const valueIdx = headers.findIndex(h => ["valor", "value", "reportedvalue", "reported_value", "valor_reportado", "valor reportado", "preco", "preço", "price"].includes(h));

  if (patientIdx === -1 || dateIdx === -1) return [];

  const results: CsvExtractedEntry[] = [];
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

    let reportedValue = cols[valueIdx] || "0.00";
    reportedValue = reportedValue.replace(/[R$\s]/g, "").replace(",", ".");

    results.push({
      patientName,
      procedureDate,
      reportedValue,
      insuranceProvider: insuranceIdx >= 0 ? cols[insuranceIdx] : undefined,
      description: descIdx >= 0 ? cols[descIdx] : undefined,
    });
  }
  return results;
}

export function generateCsvTemplate(): string {
  const bom = "\uFEFF";
  const header = "paciente;data;convenio;procedimento;valor";
  const example1 = "João Silva;01/03/2026;Unimed;Consulta cardiológica;250.00";
  const example2 = "Maria Santos;05/03/2026;Particular;Retorno dermatologia;180.50";
  const example3 = "Pedro Oliveira;10/03/2026;SulAmérica;Sleeve;1500.00";
  return bom + [header, example1, example2, example3].join("\n");
}

function levenshteinDistance(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  const matrix: number[][] = [];

  for (let i = 0; i <= la.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lb.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= la.length; i++) {
    for (let j = 1; j <= lb.length; j++) {
      const cost = la[i - 1] === lb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[la.length][lb.length];
}

function datesWithinDays(d1: Date, d2: Date, days: number): boolean {
  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

export interface ReconciliationResult {
  reconciled: Array<{ entryId: string; reportId: string; patientName: string; procedureDate: string; entryValue: string | null; reportValue: string }>;
  divergent: Array<{ entryId: string; reportId: string; patientName: string; procedureDate: string; entryValue: string | null; reportValue: string }>;
  pending: Array<{ entryId: string; patientName: string; procedureDate: string; entryValue: string | null }>;
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

  const usedReports = new Set<string>();
  const statusUpdates: Array<{ id: string; status: string }> = [];

  for (const entry of pendingEntries) {
    let matched = false;

    for (const report of reports) {
      if (usedReports.has(report.id)) continue;

      const nameDistance = levenshteinDistance(entry.patientName, report.patientName);
      const entryDate = new Date(entry.procedureDate);
      const reportDate = new Date(report.procedureDate);
      const dateMatch = datesWithinDays(entryDate, reportDate, 7);

      if (nameDistance <= 3 && dateMatch) {
        usedReports.add(report.id);
        matched = true;

        const entryVal = entry.procedureValue ? parseFloat(entry.procedureValue) : 0;
        const reportVal = parseFloat(report.reportedValue);
        const valuesMatch = Math.abs(entryVal - reportVal) < 0.01;

        if (valuesMatch) {
          result.reconciled.push({
            entryId: entry.id,
            reportId: report.id,
            patientName: entry.patientName,
            procedureDate: entry.procedureDate.toISOString(),
            entryValue: entry.procedureValue,
            reportValue: report.reportedValue,
          });
          statusUpdates.push({ id: entry.id, status: "reconciled" });
        } else {
          result.divergent.push({
            entryId: entry.id,
            reportId: report.id,
            patientName: entry.patientName,
            procedureDate: entry.procedureDate.toISOString(),
            entryValue: entry.procedureValue,
            reportValue: report.reportedValue,
          });
          statusUpdates.push({ id: entry.id, status: "divergent" });
        }
        break;
      }
    }

    if (!matched) {
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

  await storage.createNotification({
    doctorId,
    type: "reconciliation",
    title: "Conciliação concluída",
    message: `${result.reconciled.length} conferidos, ${result.divergent.length} divergentes, ${result.pending.length} pendentes`,
    read: false,
  });

  return result;
}
