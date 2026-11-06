import { it, expect } from "vitest";
import { buildRequestSummary } from "@/lib/handoff";
it("preserves follow-up context, attempted steps, source references and missing evidence", () => {
  const text = buildRequestSummary({
    id: "c",
    title: "VPN",
    messages: [
      { id: "1", role: "user", content: "Minha VPN não conecta", sources: [] },
      {
        id: "2",
        role: "user",
        content: "Uso Linux e o erro é E42",
        sources: [],
      },
      {
        id: "3",
        role: "assistant",
        content: "Não há procedimento para Linux.",
        sources: [],
        unavailableCount: 1,
      },
    ],
    steps: [{ id: "s", instruction: "Verifique a rede", result: "failed" }],
  });
  expect(text).toContain("Uso Linux e o erro é E42");
  expect(text).toContain("Verifique a rede");
  expect(text).toContain("Não há procedimento para Linux.");
  expect(text).toContain("indisponíveis");
});
it("includes the references the user can review before sharing", () => {
  const text = buildRequestSummary({
    id: "c",
    title: "VPN",
    messages: [
      {
        id: "1",
        role: "assistant",
        content: "Confira o manual",
        sources: [
          {
            chunkId: "x",
            documentId: "d",
            title: "Manual de VPN",
            location: "Página 3",
            excerpt: "Não incluir o documento inteiro",
          },
        ],
      },
    ],
    steps: [],
  });
  expect(text).toContain("Manual de VPN — Página 3");
  expect(text).not.toContain("Não incluir o documento inteiro");
});
