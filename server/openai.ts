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

export async function extractDataFromImage(base64Image: string): Promise<{
  patientName: string;
  procedureDate: string;
  insuranceProvider: string;
  description: string;
}> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `Você é um assistente especializado em extrair dados de documentos médicos.
Analise a imagem e extraia as seguintes informações:
- patientName: nome completo do paciente
- procedureDate: data do procedimento no formato YYYY-MM-DD
- insuranceProvider: nome do convênio/plano de saúde
- description: descrição do procedimento realizado

Responda APENAS com um JSON válido, sem markdown, sem explicações. Exemplo:
{"patientName":"João Silva","procedureDate":"2026-01-15","insuranceProvider":"Unimed","description":"Consulta cardiológica"}

Se não conseguir identificar algum campo, use "Não identificado" como valor.`,
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
            text: "Extraia os dados deste documento médico/recibo.",
          },
        ],
      },
    ],
    max_completion_tokens: 500,
  });

  const content = response.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    return {
      patientName: "Não identificado",
      procedureDate: new Date().toISOString().split("T")[0],
      insuranceProvider: "Não identificado",
      description: "Não identificado",
    };
  }
}

export async function extractDataFromAudio(base64Audio: string): Promise<{
  patientName: string;
  procedureDate: string;
  insuranceProvider: string;
  description: string;
}> {
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
O médico ditou informações sobre um procedimento/consulta. Extraia:
- patientName: nome completo do paciente
- procedureDate: data do procedimento no formato YYYY-MM-DD (se não mencionada, use a data de hoje: ${new Date().toISOString().split("T")[0]})
- insuranceProvider: nome do convênio/plano de saúde (se não mencionado, use "Particular")
- description: descrição do procedimento realizado

Responda APENAS com um JSON válido, sem markdown, sem explicações.
Se não conseguir identificar algum campo, use "Não identificado" como valor.`,
      },
      {
        role: "user",
        content: `Transcrição do áudio: "${transcribedText}"`,
      },
    ],
    max_completion_tokens: 500,
  });

  const content = response.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    return {
      patientName: "Não identificado",
      procedureDate: new Date().toISOString().split("T")[0],
      insuranceProvider: "Não identificado",
      description: transcribedText || "Não identificado",
    };
  }
}