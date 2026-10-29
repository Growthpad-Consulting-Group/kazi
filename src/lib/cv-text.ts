import mammoth from "mammoth";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import { createWorker } from "tesseract.js";

const MIN_TEXT_LENGTH = 50;
const OCR_MAX_PAGES = 5;

async function ocrPdf(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  const pageCount = Math.min(pdf.numPages, OCR_MAX_PAGES);
  const worker = await createWorker("eng");
  try {
    const pages: string[] = [];
    for (let page = 1; page <= pageCount; page++) {
      const image = await renderPageAsImage(pdf, page, {
        scale: 2,
        canvasImport: () => import("@napi-rs/canvas"),
      });
      const { data } = await worker.recognize(Buffer.from(image));
      pages.push(data.text);
    }
    return pages.join("\n").trim();
  } finally {
    await worker.terminate();
  }
}

/** Extract readable text from the CV formats accepted on the public application form. Falls back to OCR for scanned PDFs. */
export async function extractCvText(file: File, bytes: Uint8Array) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "pdf" || file.type === "application/pdf") {
    const { text } = await extractText(bytes, { mergePages: true });
    const trimmed = text.trim();
    if (trimmed.length >= MIN_TEXT_LENGTH) return trimmed;
    return await ocrPdf(bytes);
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
