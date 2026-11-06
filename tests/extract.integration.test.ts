import { it, expect } from "vitest";
import PDFDocument from "pdfkit";
import { extractDocument } from "@/features/documents/extract";
import { readFile } from "node:fs/promises";
async function pdf(text?: string) {
  const doc = new PDFDocument({ autoFirstPage: true });
  const chunks: Buffer[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  if (text) doc.text(text);
  doc.end();
  return done;
}
it("extracts real PDF text with page location", async () => {
  const result = await extractDocument(
    await pdf("Verifique sua rede antes de conectar."),
    "pdf",
  );
  expect(result[0].location).toBe("Página 1");
  expect(result[0].content).toContain("Verifique sua rede");
});
it("rejects a real PDF without text instead of claiming ingestion success", async () => {
  await expect(extractDocument(await pdf(), "pdf")).rejects.toThrow(
    /texto|OCR/,
  );
});
it("extracts a real DOCX and preserves paragraph location", async () => {
  const result = await extractDocument(
    await readFile("fixtures/guia-exemplo.docx"),
    "docx",
  );
  expect(result[0].location).toBe("Parágrafo 1");
  expect(result[0].content).toBe("Confira sua conexao antes de acessar a VPN.");
});
it("rejects invalid DOCX archives before extraction", async () => {
  await expect(
    extractDocument(new Uint8Array([80, 75, 0, 0]), "docx"),
  ).rejects.toThrow(/DOCX/);
});
