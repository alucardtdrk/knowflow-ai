import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { type Database, rows } from "@/lib/db";
import { createOrganization } from "@/features/teams/service";
import { retrieve } from "@/features/assistant/retrieve";
import { answer } from "@/features/assistant/service";
import type { Source } from "@/lib/types";
const state = vi.hoisted(() => ({
  timeout: false,
  nextStep: null as string | null,
  history: [] as { role: string; content: string }[],
}));
vi.mock("@/features/assistant/provider", () => ({
  generate: async (
    _q: string,
    sources: Source[],
    history: { role: string; content: string }[],
  ) => {
    state.history = history;
    if (state.timeout) throw new Error("Timeout");
    return {
      text: sources.length ? "Verifique a conexão." : "Sem evidência.",
      sources,
      nextStep: state.nextStep,
    };
  },
}));
const pg = new PGlite({ extensions: { vector } });
const db = drizzle(pg);
const a = { userId: "a" },
  b = { userId: "b" };
let scope: { organizationId: string; teamId: string };
beforeAll(async () => {
  await pg.exec(await readFile("drizzle/0000_initial.sql", "utf8"));
  await pg.exec(await readFile("drizzle/0001_chat_step_responses.sql", "utf8"));
  (globalThis as unknown as { knowflowDb: Database }).knowflowDb =
    db as unknown as Database;
  await db.execute(
    sql`INSERT INTO "user"(id,name,email) VALUES ('a','A','a@example.test'),('b','B','b@example.test')`,
  );
  scope = await createOrganization(a, "Organização A");
  const other = await createOrganization(b, "Organização B");
  for (const s of [scope, other]) {
    const [d] = await rows<{ id: string }>(
      sql`INSERT INTO documents(organization_id,team_id,title,object_key,format,size,status,created_by) VALUES (${s.organizationId},${s.teamId},'Guia VPN',${s.teamId},'txt',20,'ready',${s === scope ? "a" : "b"}) RETURNING id`,
    );
    await db.execute(
      sql`INSERT INTO chunks(document_id,location,content) VALUES (${d.id},'Parágrafo 1',${s === scope ? "Verifique sua conexão." : "Segredo da outra organização."})`,
    );
  }
});
afterAll(async () => {
  delete (globalThis as { knowflowDb?: Database }).knowflowDb;
  await pg.close();
});
it("filters text search by authorized team without embeddings", async () => {
  const sources = await retrieve(a, scope, "VPN");
  expect(sources).toHaveLength(1);
  expect(sources[0].excerpt).toBe("Verifique sua conexão.");
  await expect(retrieve(b, scope, "VPN")).rejects.toThrow();
});
it("does not persist a partial conversation on provider failure", async () => {
  state.timeout = true;
  await expect(
    answer(a, scope, { message: "Minha VPN caiu" }),
  ).rejects.toThrow();
  expect(await rows(sql`SELECT id FROM conversations`)).toHaveLength(0);
  state.timeout = false;
});
it("persists messages and enforces ten generations per minute", async () => {
  await db.execute(sql`DELETE FROM generation_limits`);
  for (let i = 0; i < 10; i++) {
    const result = await answer(a, scope, { message: "Como conectar a VPN?" });
    expect(result.sources).toHaveLength(1);
  }
  await expect(answer(a, scope, { message: "Outra pergunta" })).rejects.toThrow(
    /10 perguntas/,
  );
  expect(await rows(sql`SELECT id FROM conversations`)).toHaveLength(10);
  expect(await rows(sql`SELECT id FROM messages`)).toHaveLength(20);
  const ordered = await rows<{ role: string }>(
    sql`SELECT role FROM messages ORDER BY sequence`,
  );
  expect(ordered.slice(0, 4).map((m) => m.role)).toEqual([
    "user",
    "assistant",
    "user",
    "assistant",
  ]);
});

it("returns no evidence for unrelated queries and ignores unavailable documents", async () => {
  expect(await retrieve(a, scope, "reembolso")).toEqual([]);
  expect(await retrieve(a, scope, "!!!")).toEqual([]);
  expect(await retrieve(a, scope, "conexão")).toHaveLength(1);
  await db.execute(
    sql`UPDATE documents SET status='failed' WHERE team_id=${scope.teamId}`,
  );
  expect(await retrieve(a, scope, "VPN")).toEqual([]);
  await db.execute(
    sql`UPDATE documents SET status='ready' WHERE team_id=${scope.teamId}`,
  );
});
it("accepts a chat reply to a pending step without inferring success", async () => {
  await db.execute(sql`DELETE FROM generation_limits`);
  const [c] = await rows<{ id: string }>(
    sql`INSERT INTO conversations(organization_id,team_id,author_id,title) VALUES (${scope.organizationId},${scope.teamId},'a','VPN') RETURNING id`,
  );
  const [step] = await rows<{ id: string }>(
    sql`INSERT INTO guided_steps(conversation_id,instruction) VALUES (${c.id},'Confira a internet') RETURNING id`,
  );
  await expect(
    answer(b, scope, { conversationId: c.id, message: "Estou respondendo" }),
  ).rejects.toThrow();
  state.nextStep = "Informe a mensagem de erro";
  try {
    await answer(a, scope, {
      conversationId: c.id,
      message: "A internet funciona, mas a VPN dá timeout",
    });
    expect(
      (
        await rows<{ result: string }>(
          sql`SELECT result FROM guided_steps WHERE id=${step.id}`,
        )
      )[0].result,
    ).toBe("answered");
    expect(
      await rows(
        sql`SELECT id FROM guided_steps WHERE conversation_id=${c.id} AND result IS NULL`,
      ),
    ).toHaveLength(1);
    expect(
      await rows(
        sql`SELECT id FROM messages WHERE conversation_id=${c.id} AND content='A internet funciona, mas a VPN dá timeout'`,
      ),
    ).toHaveLength(1);
    expect(
      state.history.some((m) => m.content.includes("Confira a internet")),
    ).toBe(true);
  } finally {
    state.nextStep = null;
  }
});
it("keeps the pending step unanswered when generation fails", async () => {
  await db.execute(sql`DELETE FROM generation_limits`);
  const [c] = await rows<{ id: string }>(
    sql`INSERT INTO conversations(organization_id,team_id,author_id,title) VALUES (${scope.organizationId},${scope.teamId},'a','VPN') RETURNING id`,
  );
  const [step] = await rows<{ id: string }>(
    sql`INSERT INTO guided_steps(conversation_id,instruction) VALUES (${c.id},'Confira a rede') RETURNING id`,
  );
  state.timeout = true;
  try {
    await expect(
      answer(a, scope, {
        conversationId: c.id,
        message: "Preciso de ajuda com esta etapa",
      }),
    ).rejects.toThrow("Timeout");
    expect(
      (
        await rows<{ result: string | null }>(
          sql`SELECT result FROM guided_steps WHERE id=${step.id}`,
        )
      )[0].result,
    ).toBeNull();
    expect(
      await rows(sql`SELECT id FROM messages WHERE conversation_id=${c.id}`),
    ).toHaveLength(0);
  } finally {
    state.timeout = false;
  }
});
it("does not overwrite a button result recorded while the chat is generating", async () => {
  await db.execute(sql`DELETE FROM generation_limits`);
  const [c] = await rows<{ id: string }>(
    sql`INSERT INTO conversations(organization_id,team_id,author_id,title) VALUES (${scope.organizationId},${scope.teamId},'a','VPN') RETURNING id`,
  );
  const [step] = await rows<{ id: string }>(
    sql`INSERT INTO guided_steps(conversation_id,instruction) VALUES (${c.id},'Confira a rede') RETURNING id`,
  );
  const provider = await import("@/features/assistant/provider");
  const original = provider.generate;
  const spy = vi
    .spyOn(provider, "generate")
    .mockImplementationOnce(async (...args) => {
      await db.execute(
        sql`UPDATE guided_steps SET result='worked' WHERE id=${step.id}`,
      );
      return original(...args);
    });
  try {
    await expect(
      answer(a, scope, {
        conversationId: c.id,
        message: "Como confiro a rede?",
      }),
    ).rejects.toThrow(/etapa mudou/);
    expect(
      (
        await rows<{ result: string }>(
          sql`SELECT result FROM guided_steps WHERE id=${step.id}`,
        )
      )[0].result,
    ).toBe("worked");
    expect(
      await rows(sql`SELECT id FROM messages WHERE conversation_id=${c.id}`),
    ).toHaveLength(0);
  } finally {
    spy.mockRestore();
  }
});
