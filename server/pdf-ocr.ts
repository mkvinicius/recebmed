import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, readdirSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { extractTextFromImage } from "./ocr";

export async function ocrPdfPages(pdfBuffer: Buffer): Promise<string | null> {
  const tempDir = mkdtempSync(join(tmpdir(), "pdf-ocr-"));
  const pdfPath = join(tempDir, "input.pdf");
  const outputPrefix = join(tempDir, "page");

  try {
    writeFileSync(pdfPath, pdfBuffer);

    execSync(`pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`, {
      timeout: 60000,
      stdio: "pipe",
    });

    const pageFiles = readdirSync(tempDir)
      .filter(f => f.startsWith("page-") && f.endsWith(".png"))
      .sort();

    if (pageFiles.length === 0) {
      console.warn("[PDF-OCR] pdftoppm did not produce any page images");
      return null;
    }

    console.log(`[PDF-OCR] Converted PDF to ${pageFiles.length} page images`);

    const pageTexts: string[] = [];
    for (const file of pageFiles) {
      const imgBuffer = readFileSync(join(tempDir, file));
      const base64 = imgBuffer.toString("base64");
      const ocr = await extractTextFromImage(base64);
      if (ocr.text.trim().length > 10) {
        pageTexts.push(ocr.text.trim());
      }
    }

    const combinedText = pageTexts.join("\n\n--- Página ---\n\n");

    if (combinedText.length < 30) {
      console.warn("[PDF-OCR] OCR produced insufficient text from scanned pages");
      return null;
    }

    console.log(`[PDF-OCR] OCR extracted ${combinedText.length} chars from ${pageTexts.length} pages`);
    return combinedText;
  } catch (err) {
    console.warn("[PDF-OCR] Failed:", (err as Error).message);
    return null;
  } finally {
    try {
      const files = readdirSync(tempDir);
      for (const f of files) unlinkSync(join(tempDir, f));
      require("fs").rmdirSync(tempDir);
    } catch {}
  }
}
