import { describe, it, expect } from "vitest";
import { validateFile, chunkSections } from "@/features/documents/extract";

describe("document input", () => {
  it("rejects empty, oversized and disguised content", () => {
    expect(() => validateFile("x.txt", new Uint8Array())).toThrow();
    expect(() =>
      validateFile("x.txt", new Uint8Array(20 * 1024 * 1024 + 1)),
    ).toThrow();
    expect(() =>
      validateFile("x.pdf", new TextEncoder().encode("not a pdf")),
    ).toThrow();
    expect(() =>
      validateFile("x.docx", new TextEncoder().encode("not a zip")),
    ).toThrow();
    expect(() => validateFile("x.txt", new Uint8Array([0, 1, 2]))).toThrow();
    expect(() =>
      validateFile("x.exe", new TextEncoder().encode("hello")),
    ).toThrow();
    expect(
      validateFile("manual.TXT", new TextEncoder().encode("Orientações")),
    ).toBe("txt");
  });
  it("accepts exact size boundary", () => {
    expect(
      validateFile("x.txt", new Uint8Array(20 * 1024 * 1024).fill(65)),
    ).toBe("txt");
  });
  it("preserves locations and limits chunks without losing text", () => {
    const content = "a".repeat(3000);
    const chunks = chunkSections([
      { location: "Página 2", text: content },
      { location: "Página 3", text: "Fim" },
    ]);
    expect(chunks[0].location).toBe("Página 2");
    expect(chunks.every((c) => c.content.length <= 1600)).toBe(true);
    expect(
      chunks
        .filter((c) => c.location === "Página 2")
        .map((c) => c.content)
        .join(""),
    ).toBe(content);
    expect(chunks.at(-1)?.location).toBe("Página 3");
  });
  it("rejects empty extracted text and excessive output", () => {
    expect(() =>
      chunkSections([{ location: "Página 1", text: "  " }]),
    ).toThrow();
    expect(() =>
      chunkSections([{ location: "Página 1", text: "a".repeat(1_000_001) }]),
    ).toThrow();
  });
});
