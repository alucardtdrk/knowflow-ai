import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { type Database, rows } from "@/lib/db";
import { createOrganization } from "@/features/teams/service";
import { processNextJob } from "@/features/documents/worker";
import {
  uploadDocument,
  retryDocument,
  deleteDocument,
} from "@/features/documents/service";

const external = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  failPut: false,
  failGet: false,
  onEmbed: null as null | (() => Promise<void>),
}));
vi.mock("@/features/documents/storage", () => ({
  putObject: async (key: string, data: Uint8Array) => {
    external.files.set(key, data);
  },
  getObject: async (key: string) => {
    if (external.failGet) throw new Error("Storage down");
    return external.files.get(key)!;
  },
  deleteObject: async (key: string) => {
    external.files.delete(key);
  },
}));
vi.mock("@/features/assistant/provider", () => ({
  embed: async (texts: string[]) => {
    if (external.onEmbed) await external.onEmbed();
    return texts.map(() => [1, ...Array(1535).fill(0)]);
  },
}));
const pg = new PGlite({ extensions: { vector } });
const db = drizzle(pg);
const actor = { userId: "worker-user" };
let scope: { organizationId: string; teamId: string };
beforeAll(async () => {
  await pg.exec(await readFile("drizzle/0000_initial.sql", "utf8"));
  (globalThis as unknown as { knowflowDb: Database }).knowflowDb =
    db as unknown as Database;
  await db.execute(
    sql`INSERT INTO "user"(id,name,email) VALUES ('worker-user','Test','worker@example.test')`,
  );
  scope = await createOrganization(actor, "Worker test");
});
beforeEach(async () => {
  await db.execute(sql`DELETE FROM documents`);
  external.failGet = false;
  external.onEmbed = null;
  external.files.clear();
});
afterAll(async () => {
  delete (globalThis as { knowflowDb?: Database }).knowflowDb;
  await pg.close();
});
const file = () =>
  new File(
    ["Abra o navegador e confirme que a internet está funcionando."],
    "VPN.txt",
  );
it("processes a real upload into searchable chunks with source location", async () => {
  const { id } = await uploadDocument(actor, scope, file());
  await processNextJob();
  expect(
    (
      await rows<{ status: string }>(
        sql`SELECT status FROM documents WHERE id=${id}`,
      )
    )[0].status,
  ).toBe("ready");
  const [chunk] = await rows<{ location: string; content: string }>(
    sql`SELECT location,content FROM chunks WHERE document_id=${id}`,
  );
  expect(chunk.location).toBe("Parágrafo 1");
  expect(chunk.content).toBe(
    "Abra o navegador e confirme que a internet está funcionando.",
  );
  expect(await processNextJob()).toBe(false);
});
it("bounds retries and allows explicit recovery after an external storage failure", async () => {
  const { id } = await uploadDocument(actor, scope, file());
  external.failGet = true;
  await processNextJob();
  await processNextJob();
  await processNextJob();
  expect(
    (
      await rows<{ status: string }>(
        sql`SELECT status FROM documents WHERE id=${id}`,
      )
    )[0].status,
  ).toBe("failed");
  expect(await processNextJob()).toBe(false);
  external.failGet = false;
  await retryDocument(actor, scope, id);
  await processNextJob();
  expect(
    (
      await rows<{ status: string }>(
        sql`SELECT status FROM documents WHERE id=${id}`,
      )
    )[0].status,
  ).toBe("ready");
});
it("does not resurrect a document deleted while embeddings are in flight", async () => {
  const { id } = await uploadDocument(actor, scope, file());
  external.onEmbed = async () => {
    await deleteDocument(actor, scope, id);
  };
  await processNextJob();
  expect(
    (
      await rows<{ status: string }>(
        sql`SELECT status FROM documents WHERE id=${id}`,
      )
    )[0].status,
  ).toBe("deleted");
  expect(
    await rows(sql`SELECT id FROM chunks WHERE document_id=${id}`),
  ).toHaveLength(0);
  await processNextJob();
  expect(external.files.size).toBe(0);
});
it("removes orphaned objects if membership is revoked after upload starts", async () => {
  // The storage boundary below triggers revocation only for this operation.
  const storage = await import("@/features/documents/storage");
  const original = storage.putObject;
  const spy = vi
    .spyOn(storage, "putObject")
    .mockImplementationOnce(async (key, data) => {
      await original(key, data);
      await db.execute(
        sql`DELETE FROM team_members WHERE user_id=${actor.userId}`,
      );
    });
  await expect(uploadDocument(actor, scope, file())).rejects.toThrow();
  expect(external.files.size).toBe(0);
  await db.execute(
    sql`INSERT INTO team_members VALUES (${scope.organizationId},${scope.teamId},${actor.userId},'manager')`,
  );
  spy.mockRestore();
});
