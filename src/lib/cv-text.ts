import mammoth from "mammoth";
import { extractText } from "unpdf";

/**
 * Extract readable text from the CV formats accepted on the public application
 * form. Scanned, image-only PDFs come back with little or no text, and callers
 * reject those with a "not enough readable text" message. OCR was removed for
 * the Cloudflare Workers runtime: it needed native canvas and tesseract.js,
 * which cannot be bundled there.
 */
export async function extractCvText(file: File, bytes: Uint8Array) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "pdf" || file.type === "application/pdf") {
    const { text } = await extractText(bytes, { mergePages: true });
    return text.trim();
  }

  if (
    extension === "docx" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value.trim();
  }

  return (await file.text()).trim();
}
