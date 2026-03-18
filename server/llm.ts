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
