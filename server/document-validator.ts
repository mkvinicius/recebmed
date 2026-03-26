import { createHash } from "crypto";
import { llmChatCompletion, getComplexParsingProvider } from "./llm";
import { parsePdfText } from "./pdf-util";

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  sampleValues: string[];
}

export interface AnalysisResult {
  columns: ColumnMapping[];
  sampleRows: Record<string, string>[];
  documentType: string;
}

const RECEBMED_FIELDS = [
  "patientName",
  "procedureDate",
  "insuranceProvider",
  "procedureName",
  "reportedValue",
  "paymentMethod",
  "patientBirthDate",
  "description",
  "ignore",
];

export function computeDocumentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function analyzeDocumentStructure(
  fileBuffer: Buffer,
  fileType: "pdf" | "csv" | "xlsx"
): Promise<AnalysisResult> {
  let textContent: string;

  if (fileType === "pdf") {
    textContent = await parsePdfText(fileBuffer);
  } else {
    textContent = fileBuffer.toString("utf-8");
  }

  if (!textContent || textContent.trim().length < 20) {
    throw new Error("O documento não contém texto suficiente para análise.");
  }

  const preview = textContent.substring(0, 8000);

  const provider = getComplexParsingProvider();

  const result = await provider.chatCompletion({
    messages: [
      {
        role: "system",
        content: `Você é um analisador de estrutura de documentos médicos brasileiros.
Analise o conteúdo do documento e identifique:
1. Todas as colunas/campos encontrados
2. Os primeiros 5 registros de exemplo
3. O tipo de documento (ex: "Conta Corrente", "Guia TISS", "Extrato de Produção", "Nota Fiscal", etc.)

Para cada coluna, sugira o mapeamento mais provável para os campos do RecebMed:
- patientName: Nome do paciente/beneficiário
- procedureDate: Data do procedimento/atendimento
- insuranceProvider: Convênio/plano de saúde
- procedureName: Nome/tipo do procedimento
- reportedValue: Valor financeiro
- paymentMethod: Forma de pagamento (PIX, Dinheiro, Cartão, etc.)
- patientBirthDate: Data de nascimento
- description: Descrição/observações
- ignore: Colunas irrelevantes (cabeçalhos, totais, IDs internos)

REGRAS:
- Se uma coluna contém formas de pagamento (PIX, Dinheiro, Cartão, Redecard), mapeie como "paymentMethod", NÃO como "insuranceProvider"
- Se a coluna se chama "Espécie" e contém códigos como PX, DN, CC, RE, mapeie como "paymentMethod"
- Retorne valores de exemplo reais extraídos do documento

Responda APENAS com JSON válido no formato:
{
  "documentType": "tipo do documento",
  "columns": [
    {"sourceColumn": "Nome da Coluna", "targetField": "campo_recebmed", "sampleValues": ["valor1", "valor2"]}
  ],
  "sampleRows": [
    {"Nome da Coluna": "valor", ...}
  ]
}`,
      },
      {
        role: "user",
        content: `Analise a estrutura deste documento e identifique colunas e mapeamentos:\n\n${preview}`,
      },
    ],
    maxTokens: 4000,
  });

  try {
    let cleaned = result.content.replace(/```json\s*|```\s*/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    if (firstBrace > 0) cleaned = cleaned.substring(firstBrace);
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace > 0) cleaned = cleaned.substring(0, lastBrace + 1);

    const parsed = JSON.parse(cleaned);
    return {
      documentType: parsed.documentType || "Desconhecido",
      columns: (parsed.columns || []).map((c: any) => ({
        sourceColumn: c.sourceColumn || "",
        targetField: RECEBMED_FIELDS.includes(c.targetField) ? c.targetField : "ignore",
        sampleValues: Array.isArray(c.sampleValues) ? c.sampleValues.slice(0, 3) : [],
      })),
      sampleRows: Array.isArray(parsed.sampleRows) ? parsed.sampleRows.slice(0, 5) : [],
    };
  } catch {
    throw new Error("Não foi possível analisar a estrutura do documento. Tente com um arquivo diferente.");
  }
}

export function buildTemplatePrompt(mappingJson: string): string {
  try {
    const mapping: ColumnMapping[] = JSON.parse(mappingJson);
    const fieldMap = mapping
      .filter(m => m.targetField !== "ignore")
      .map(m => `- Coluna "${m.sourceColumn}" → campo "${m.targetField}"`)
      .join("\n");

    return `\n\nMAPEAMENTO DE COLUNAS DO DOCUMENTO (Template salvo pelo usuário):
${fieldMap}

Use este mapeamento para extrair os dados corretamente. As colunas do documento correspondem aos campos RecebMed conforme descrito acima.
Se a coluna mapeada como "paymentMethod" contiver formas de pagamento (PIX, Dinheiro, Cartão, etc.), defina insuranceProvider como "Particular".`;
  } catch {
    return "";
  }
}
