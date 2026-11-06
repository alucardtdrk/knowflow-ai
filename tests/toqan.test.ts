import { afterEach, expect, it, vi } from "vitest";
import { generate } from "@/features/assistant/provider";
const source = {
  chunkId: "chunk-1",
  documentId: "doc-1",
  title: "VPN",
  location: "Parágrafo 1",
  excerpt: "Verifique sua conexão.",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function configured() {
  vi.stubEnv("TOQAN_API_KEY", "test-only-key");
  vi.stubEnv("OPENAI_API_KEY", "");
}
it("uses Toqan without OpenAI, polls and validates citations", async () => {
  configured();
  vi.useFakeTimers();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ conversation_id: "c1", request_id: "r1" }),
    )
    .mockResolvedValueOnce(Response.json({ status: "in_progress", answer: "" }))
    .mockResolvedValueOnce(
      Response.json({
        status: "finished",
        answer:
          "<think>private reasoning</think>\n```json\n" +
          JSON.stringify({
            text: "Verifique sua conexão.",
            sourceIds: [source.chunkId],
            nextStep: null,
          }) +
          "\n```",
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  const pending = generate("Minha VPN caiu", [source], []);
  await vi.runAllTimersAsync();
  expect((await pending).sources).toEqual([source]);
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("https://api.toqan.ai/api/create_conversation");
  expect(init.headers["X-Api-Key"]).toBe("test-only-key");
  expect(JSON.parse(init.body).user_message).toContain(source.excerpt);
  expect(fetcher.mock.calls[1][0]).toContain(
    "get_answer?conversation_id=c1&request_id=r1",
  );
  expect(fetcher.mock.calls[1][1].method).toBe("GET");
});
it("does not call Toqan without evidence", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect((await generate("VPN", [], [])).sources).toEqual([]);
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([401, 403, 429, 500])(
  "handles HTTP %s without exposing credentials",
  async (status) => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("secret response", { status })),
    );
    await expect(generate("VPN", [source], [])).rejects.toThrow(/Toqan/);
  },
);
it("rejects invented citations in a completed Toqan response", async () => {
  configured();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ conversation_id: "c", request_id: "r" }),
      )
      .mockResolvedValueOnce(
        Response.json({
          status: "finished",
          answer: JSON.stringify({
            text: "Inventado",
            sourceIds: ["other-team"],
            nextStep: null,
          }),
        }),
      ),
  );
  expect((await generate("VPN", [source], [])).sources).toEqual([]);
});
it("handles malformed provider output and failed jobs", async () => {
  configured();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ conversation_id: "c", request_id: "r" }),
    )
    .mockResolvedValueOnce(
      Response.json({ status: "error", answer: "secret" }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(generate("VPN", [source], [])).rejects.toThrow(/Toqan/);
});
it("cancels polling when the total request deadline is reached", async () => {
  configured();
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ conversation_id: "c", request_id: "r" }),
      )
      .mockResolvedValue(Response.json({ status: "in_progress", answer: "" })),
  );
  const result = expect(generate("VPN", [source], [])).rejects.toThrow(/Toqan/);
  await vi.advanceTimersByTimeAsync(46000);
  await result;
});

it("requires the Toqan key even if an OpenAI key exists", async () => {
  vi.stubEnv("TOQAN_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "unused-fixture");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(generate("VPN", [source], [])).rejects.toThrow(/chave do Toqan/);
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(["not JSON", '{"text":"incomplete"}'])(
  "does not persist malformed model output: %s",
  async (answer) => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ conversation_id: "c", request_id: "r" }),
        )
        .mockResolvedValueOnce(Response.json({ status: "finished", answer })),
    );
    if (answer === "not JSON")
      await expect(generate("VPN", [source], [])).rejects.toThrow(/Toqan/);
    else expect((await generate("VPN", [source], [])).sources).toEqual([]);
  },
);
it("records only safe diagnostics for malformed Toqan responses", async () => {
  configured();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ conversation_id: "c", request_id: "r" }),
        )
        .mockResolvedValueOnce(
          Response.json({
            status: "finished",
            answer: "private model content",
          }),
        )
        .mockResolvedValueOnce(
          Response.json({ conversation_id: "c2", request_id: "r2" }),
        )
        .mockResolvedValueOnce(
          Response.json({
            status: "finished",
            answer: "private model content",
          }),
        ),
    );
    await expect(generate("VPN", [source], [])).rejects.toThrow(/Toqan/);
    expect(log).toHaveBeenCalledWith("Falha na consulta ao Toqan", {
      phase: "parse-answer",
      type: "SyntaxError",
      timeout: false,
    });
    const diagnostics = JSON.stringify(log.mock.calls);
    expect(diagnostics).not.toContain("private model content");
    expect(diagnostics).not.toContain("test-only-key");
    expect(diagnostics).not.toContain(source.excerpt);
  } finally {
    log.mockRestore();
  }
});
it.each([
  "Aqui está a orientação solicitada:\n```json\n",
  "Resposta baseada nos documentos:\n```json\n",
])(
  "accepts a single JSON block preceded by explanatory text",
  async (prefix) => {
    configured();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ conversation_id: "c", request_id: "r" }),
        )
        .mockResolvedValueOnce(
          Response.json({
            status: "finished",
            answer:
              prefix +
              JSON.stringify({
                text: "Verifique sua conexão.",
                sourceIds: [source.chunkId],
                nextStep: null,
              }) +
              "\n```\nConfira a fonte.",
          }),
        ),
    );
    expect((await generate("VPN", [source], [])).sources).toEqual([source]);
  },
);
it("rejects ambiguous multiple JSON blocks", async () => {
  configured();
  const block =
    "```json\n" +
    JSON.stringify({
      text: "Resposta",
      sourceIds: [source.chunkId],
      nextStep: null,
    }) +
    "\n```";
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ conversation_id: "c", request_id: "r" }),
      )
      .mockResolvedValueOnce(
        Response.json({ status: "finished", answer: block + "\n" + block }),
      ),
  );
  await expect(generate("VPN", [source], [])).rejects.toThrow(/Toqan/);
});

it.each([
  '{"text":"Abra a opção "Criar".","sourceIds":["chunk-1"],"nextStep":null}',
  "Resposta sem JSON",
])(
  "retries invalid JSON once and still validates source IDs",
  async (malformed) => {
    configured();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ conversation_id: "c1", request_id: "r1" }),
      )
      .mockResolvedValueOnce(
        Response.json({ status: "finished", answer: malformed }),
      )
      .mockResolvedValueOnce(
        Response.json({ conversation_id: "c2", request_id: "r2" }),
      )
      .mockResolvedValueOnce(
        Response.json({
          status: "finished",
          answer: JSON.stringify({
            text: 'Abra a opção "Criar".',
            sourceIds: [source.chunkId],
            nextStep: null,
          }),
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect((await generate("Como abrir?", [source], [])).sources).toEqual([
      source,
    ]);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(JSON.parse(fetcher.mock.calls[2][1].body).user_message).toContain(
      "Escape todas as aspas",
    );
  },
);
