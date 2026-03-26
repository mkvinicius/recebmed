import { PDFParse } from "pdf-parse";

export async function parsePdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    verbosity: 0,
  });
  try {
    await parser.load();
    const result = await parser.getText();
    return typeof result === "string" ? result : result?.text || "";
  } finally {
    parser.destroy();
  }
}
