import OpenAI from "openai";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface LLMCompletionOptions {
  model?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCompletionResult {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface LLMProvider {
  name: string;
  chatCompletion(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
  isAvailable(): boolean;
}

class OpenAIProvider implements LLMProvider {
  name = "openai";
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async chatCompletion(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const client = this.getClient();
    const response = await client.chat.completions.create({
      model: options.model || "gpt-5-mini",
      messages: options.messages as any,
      max_completion_tokens: options.maxTokens || 4000,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    });

    return {
      content: response.choices[0]?.message?.content || "",
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
      } : undefined,
    };
  }
}

class AnthropicProvider implements LLMProvider {
  name = "anthropic";

  private getClient() {
    const Anthropic = require("@anthropic-ai/sdk").default;
    const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined;
    if (!apiKey) throw new Error("No Anthropic API key configured");
    return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }

  isAvailable(): boolean {
    return !!(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
  }

  async chatCompletion(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const client = this.getClient();

    let systemPrompt = "";
    const messages: any[] = [];

    for (const msg of options.messages) {
      if (msg.role === "system") {
        systemPrompt += (typeof msg.content === "string" ? msg.content : "") + "\n";
      } else {
        let content: any;
        if (typeof msg.content === "string") {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content.map((part: any) => {
            if (part.type === "text") return { type: "text", text: part.text };
            if (part.type === "image_url" && part.image_url?.url) {
              const url = part.image_url.url;
              if (url.startsWith("data:")) {
                const match = url.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                  return {
                    type: "image",
                    source: { type: "base64", media_type: match[1], data: match[2] },
                  };
                }
              }
              return { type: "text", text: `[Image: ${url}]` };
            }
            return { type: "text", text: JSON.stringify(part) };
          });
        }
        messages.push({ role: msg.role, content });
      }
    }

    const modelMap: Record<string, string> = {
      "gpt-5-mini": "claude-sonnet-4-6",
      "gpt-4o": "claude-sonnet-4-6",
      "complex": "claude-sonnet-4-6",
    };

    const claudeModel = modelMap[options.model || "gpt-5-mini"] || "claude-sonnet-4-6";

    const response = await client.messages.create({
      model: claudeModel,
      max_tokens: options.maxTokens || 4000,
      ...(systemPrompt ? { system: systemPrompt.trim() } : {}),
      messages,
    });

    const textContent = response.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("");

    return {
      content: textContent,
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      } : undefined,
    };
  }
}

const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
};

function getDefaultProvider(): string {
  return process.env.LLM_PROVIDER || "openai";
}

export function getLLMProvider(providerName?: string): LLMProvider {
  const name = providerName || getDefaultProvider();
  const provider = providers[name];
  if (!provider) {
    throw new Error(`LLM provider "${name}" not found. Available: ${Object.keys(providers).join(", ")}`);
  }
  return provider;
}

export function getComplexParsingProvider(): LLMProvider {
  if (providers.anthropic.isAvailable()) {
    return providers.anthropic;
  }
  return providers.openai;
}

export async function llmChatCompletion(
  options: LLMCompletionOptions,
  providerName?: string
): Promise<LLMCompletionResult> {
  const provider = getLLMProvider(providerName);
  return provider.chatCompletion(options);
}

export interface AIAnomalyResult {
  anomalies: Array<{
    type: "duplicate" | "value_outlier" | "missing_data" | "suspicious_pattern";
    severity: "high" | "medium" | "low";
    description: string;
    entryIds: string[];
  }>;
}

export async function aiAnomalyScan(
  entries: Array<{ id: string; patientName: string; procedureDate: string; description: string | null; insuranceProvider: string; procedureValue: string | null; status: string }>,
  doctrine?: string,
): Promise<AIAnomalyResult> {
  if (entries.length < 2) {
    return { anomalies: [] };
  }

  const provider = getComplexParsingProvider();

  const entriesList = entries.map((e, i) =>
    `[${i + 1}] ID:${e.id} | ${e.patientName} | ${e.procedureDate} | ${e.description || "(vazio)"} | ${e.insuranceProvider} | R$${e.procedureValue || "0"} | ${e.status}`
  ).join("\n");

  const result = await provider.chatCompletion({
    model: "complex",
    maxTokens: 2000,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `Você é um auditor financeiro especializado em consultórios médicos brasileiros.
${doctrine ? `\nDOUTRINA DA PLATAFORMA (instruções do administrador — leia, aprenda e siga ANTES de analisar):\n${doctrine}\n\nApós seguir a doutrina acima, use também seu conhecimento e liberdade para encontrar problemas que a doutrina não previu.\n` : ""}
TAREFA: Analise os lançamentos e identifique ANOMALIAS reais.

TIPOS DE ANOMALIA:
1. **duplicate** — Mesmo paciente, mesma data, procedimento igual ou muito similar (variações de escrita contam). Mesmo paciente com procedimentos DIFERENTES na mesma data NÃO é duplicata.
2. **value_outlier** — Valor muito discrepante para o mesmo tipo de procedimento (ex: mesma consulta cobrada R$150 e R$1500).
3. **missing_data** — Lançamento sem descrição de procedimento ou valor zerado/nulo.
4. **suspicious_pattern** — Padrão suspeito (ex: muitos procedimentos iguais no mesmo dia para pacientes diferentes, o que pode indicar erro de importação).

REGRAS:
- Só reporte anomalias com certeza razoável, não suposições vagas.
- Mesmo paciente pode ter vários atendimentos legítimos (retorno, procedimento diferente, etc).
- Agrupe duplicatas: se A e B são iguais, reporte ambos IDs juntos.
- Máximo 10 anomalias mais relevantes.
- Retorne JSON VÁLIDO.

Formato de resposta:
{"anomalies": [{"type": "duplicate"|"value_outlier"|"missing_data"|"suspicious_pattern", "severity": "high"|"medium"|"low", "description": "explicação curta em português", "entryIds": ["id1", "id2"]}]}`
      },
      {
        role: "user",
        content: `LANÇAMENTOS PARA ANÁLISE:\n${entriesList}`
      }
    ]
  });

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { anomalies: (parsed.anomalies || []).slice(0, 10) };
    }
  } catch (err) {
    console.error("[AI-Scan] Parse error:", err);
  }

  return { anomalies: [] };
}

export interface AIDuplicateCheckResult {
  isDuplicate: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
  matchedEntryId?: string;
}

export async function aiDuplicateCheck(
  newEntry: { patientName: string; procedureDate: string; description: string | null; insuranceProvider: string; procedureValue: string | null },
  existingEntries: Array<{ id: string; patientName: string; procedureDate: string; description: string | null; insuranceProvider: string; procedureValue: string | null }>
): Promise<AIDuplicateCheckResult> {
  if (existingEntries.length === 0) {
    return { isDuplicate: false, confidence: "high", reason: "Nenhum lançamento similar encontrado" };
  }

  const provider = getComplexParsingProvider();

  const existingList = existingEntries.map((e, i) =>
    `[${i + 1}] ID: ${e.id}\n    Paciente: ${e.patientName}\n    Data: ${e.procedureDate}\n    Procedimento: ${e.description || "(vazio)"}\n    Convênio: ${e.insuranceProvider}\n    Valor: ${e.procedureValue || "(vazio)"}`
  ).join("\n\n");

  const result = await provider.chatCompletion({
    model: "complex",
    maxTokens: 500,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `Você é um validador de duplicatas para um sistema financeiro médico brasileiro.

TAREFA: Comparar um NOVO lançamento com lançamentos EXISTENTES e determinar se é DUPLICATA.

REGRAS IMPORTANTES:
- O MESMO paciente pode ter VÁRIOS atendimentos diferentes (consultas, retornos, procedimentos distintos).
- Só é duplicata quando TODOS os critérios coincidem: mesmo paciente, mesma data, mesmo procedimento/descrição, mesmo convênio.
- Variações de escrita do MESMO procedimento são duplicata (ex: "Limpeza" vs "Profilaxia dental", "Consulta" vs "Consulta médica").
- Variações de nome que claramente são a mesma pessoa são duplicata (ex: "Maria Silva" vs "Maria da Silva", "João P. Santos" vs "João Pedro Santos").
- Se a data for diferente, NÃO é duplicata mesmo que tudo mais coincida (pode ser retorno).
- Se o procedimento/descrição for claramente diferente, NÃO é duplicata mesmo na mesma data (ex: "Consulta" vs "Radiografia").
- Se o valor for significativamente diferente E o procedimento parece diferente, NÃO é duplicata.
- Na DÚVIDA, responda que NÃO é duplicata. É melhor permitir uma entrada extra do que bloquear um lançamento legítimo.

Responda APENAS em JSON válido:
{"isDuplicate": boolean, "confidence": "high"|"medium"|"low", "reason": "explicação curta em português", "matchedEntryId": "id do existente ou null"}`
      },
      {
        role: "user",
        content: `NOVO LANÇAMENTO:
Paciente: ${newEntry.patientName}
Data: ${newEntry.procedureDate}
Procedimento: ${newEntry.description || "(vazio)"}
Convênio: ${newEntry.insuranceProvider}
Valor: ${newEntry.procedureValue || "(vazio)"}

LANÇAMENTOS EXISTENTES:
${existingList}`
      }
    ]
  });

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isDuplicate: parsed.isDuplicate === true && parsed.confidence === "high",
        confidence: parsed.confidence || "low",
        reason: parsed.reason || "",
        matchedEntryId: parsed.matchedEntryId || undefined,
      };
    }
  } catch (err) {
    console.error("AI duplicate check parse error:", err);
  }

  return { isDuplicate: false, confidence: "low", reason: "Não foi possível validar — entrada permitida" };
}
