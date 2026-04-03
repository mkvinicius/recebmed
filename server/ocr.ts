import Tesseract from "tesseract.js";

const MIN_CONFIDENCE = 60;
const MIN_TEXT_LENGTH = 30;

export interface OcrResult {
  text: string;
  confidence: number;
  usable: boolean;
}

export async function extractTextFromImage(base64Image: string): Promise<OcrResult> {
  try {
    const buffer = Buffer.from(base64Image, "base64");

    const { data } = await Tesseract.recognize(buffer, "por", {
      logger: () => {},
    });

    const text = data.text?.trim() || "";
    const confidence = data.confidence || 0;
    const usable = confidence >= MIN_CONFIDENCE && text.length >= MIN_TEXT_LENGTH;

    console.log(`[OCR] Confidence: ${confidence.toFixed(1)}%, text length: ${text.length}, usable: ${usable}`);

    return { text, confidence, usable };
  } catch (err) {
    console.warn("[OCR] Failed, will fall back to vision AI:", (err as Error).message);
    return { text: "", confidence: 0, usable: false };
  }
}
