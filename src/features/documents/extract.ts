import { AppError } from "@/lib/errors";
export type Format = "pdf" | "docx" | "txt";
export function validateFile(name: string, data: Uint8Array): Format {
  if (!data.length || data.length > 20 * 1024 * 1024)
    throw new AppError("Envie um arquivo de até 20 MB, com conteúdo.");
  const extension = name.split(".").pop()?.toLowerCase();
  if (!["pdf", "docx", "txt"].includes(extension || ""))
    throw new AppError("Formatos aceitos: PDF com texto, DOCX e TXT.");
  const magic = Buffer.from(data.subarray(0, 8));
  if (extension === "pdf" && !magic.toString().startsWith("%PDF-"))
    throw new AppError("O conteúdo não é um PDF válido.");
  if (extension === "docx" && (magic[0] !== 0x50 || magic[1] !== 0x4b))
    throw new AppError("O conteúdo não é um DOCX válido.");
  if (extension === "txt") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(data);
    } catch {
      throw new AppError("Salve o texto no formato UTF-8.");
    }
    if (data.includes(0))
      throw new AppError("O arquivo contém dados binários.");
  }
  return extension as Format;
}
export function chunkSections(sections: { location: string; text: string }[]) {
  if (sections.reduce((n, s) => n + s.text.length, 0) > 1_000_000)
    throw new AppError("Documento muito extenso. Divida em arquivos menores.");
  const chunks: { location: string; content: string }[] = [];
  for (const section of sections) {
    const text = section.text.trim();
    for (let offset = 0; offset < text.length; offset += 1600)
      chunks.push({
        location: section.location,
        content: text.slice(offset, offset + 1600),
      });
  }
  if (!chunks.length)
    throw new AppError(
      "Não encontramos texto. PDFs digitalizados precisam de OCR antes do envio.",
    );
  return chunks;
}
export async function extractDocument(data: Uint8Array, format: Format) {
  if (format === "txt")
    return chunkSections(
      new TextDecoder()
        .decode(data)
        .split(/\n\s*\n/)
        .map((text, i) => ({ location: `Parágrafo ${i + 1}`, text })),
    );
  if (format === "docx") {
    const { validateDocx } = await import("./validate-docx");
    await validateDocx(data);
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    return chunkSections(
      result.value
        .split(/\n\s*\n/)
        .map((text, i) => ({ location: `Parágrafo ${i + 1}`, text })),
    );
  }
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    const info = await parser.getInfo();
    if (info.total > 500)
      throw new AppError(
        "O limite é 500 páginas por PDF. Divida em arquivos menores.",
      );
    const result = await parser.getText();
    return chunkSections(
      result.pages.map((p) => ({ location: `Página ${p.num}`, text: p.text })),
    );
  } finally {
    await parser.destroy();
  }
}
