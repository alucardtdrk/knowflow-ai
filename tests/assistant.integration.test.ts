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
const state = vi.hoisted(() => ({ timeout: false }));
vi.mock("@/features/assistant/provider", () => ({
  embed: async () => [[1, ...Array(1535).fill(0)]],
  generate: async (_q: string, sources: Source[]) => {
    if (state.timeout) throw new Error("Timeout");
    return {
      text: sources.length ? "Verifique a conexão." : "Sem evidência.",
      sources,
      nextStep: null,
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
  (globalThis as unknown as { knowflowDb: Database }).knowflowDb =
    db as unknown as Database;
  await db.execute(
    sql`INSERT INTO "user"(id,name,email) VALUES ('a','A','a@example.test'),('b','B','b@example.test')`,
  );
  scope = await createOrganization(a, "Organização A");
  const other = await createOrganization(b, "Organização B");
  for (const s of [scope, other]) {
    const [d] = await rows<{ id: string }>(
      sql`INSERT INTO documents(organization_id,team_id,title,object_key,format,size,status,created_by) VALUES (${s.organizationId},${s.teamId},'Guia',${s.teamId},'txt',20,'ready',${s === scope ? "a" : "b"}) RETURNING id`,
    );
    await db.execute(
      sql`INSERT INTO chunks(document_id,location,content,embedding) VALUES (${d.id},'Parágrafo 1',${s === scope ? "Verifique sua conexão." : "Segredo da outra organização."},${JSON.stringify([1, ...Array(1535).fill(0)])}::vector)`,
    );
  }
});
afterAll(async () => {
  delete (globalThis as { knowflowDb?: Database }).knowflowDb;
  await pg.close();
});
it("filters vector search by authorized team even for identical vectors", async () => {
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
