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

export async function extractPdfData(pdfBuffer: Buffer): Promise<PdfExtractedEntry[]> {
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text;

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `Você é um assistente especializado em extrair dados de relatórios financeiros de clínicas médicas.
Analise o texto extraído de um PDF e extraia TODOS os registros de pacientes/procedimentos encontrados.
Para cada registro, extraia:
- patientName: nome completo do paciente
- procedureDate: data do procedimento no formato YYYY-MM-DD
- reportedValue: valor reportado do procedimento (apenas números com ponto decimal, ex: "150.00")
- description: descrição do procedimento (se disponível)

Responda APENAS com um array JSON válido, sem markdown, sem explicações.
Se não conseguir identificar algum campo, use "Não identificado" como valor.
Se o valor não for encontrado, use "0.00".`,
      },
      {
        role: "user",
        content: `Texto extraído do PDF do relatório da clínica:\n\n${text}`,
      },
    ],
    max_completion_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || "[]";
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch {
    return [];
  }
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
