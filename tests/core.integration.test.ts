import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { type Database, rows } from "@/lib/db";
import { requireTeamAccess } from "@/lib/access";
import {
  createOrganization,
  createTeam,
  inviteMember,
  acceptInvitation,
  changeMember,
  joinTeamAsAdmin,
} from "@/features/teams/service";
import { createRequest, updateRequest } from "@/features/requests/service";
import {
  getSource,
  deleteDocument,
  retryDocument,
} from "@/features/documents/service";
import {
  ownConversation,
  recordStepResult,
} from "@/features/assistant/service";

const pg = new PGlite({ extensions: { vector } });
const db = drizzle(pg, { schema });
const alice = { userId: "alice" },
  bob = { userId: "bob" };
let scope: { organizationId: string; teamId: string };
beforeAll(async () => {
  await pg.exec(await readFile("drizzle/0000_initial.sql", "utf8"));
  (globalThis as unknown as { knowflowDb: Database }).knowflowDb =
    db as unknown as Database;
  process.env.BETTER_AUTH_SECRET =
    "integration-test-secret-not-for-production-1234";
  await db.execute(
    sql`INSERT INTO "user"(id,name,email) VALUES ('alice','Alice','alice@example.test'),('bob','Bob','bob@example.test')`,
  );
  scope = await createOrganization(alice, "Organização A");
});
afterAll(async () => {
  delete (globalThis as { knowflowDb?: Database }).knowflowDb;
  await pg.close();
});

describe("real database authorization", () => {
  it("isolates teams even from their organization administrator", async () => {
    await expect(requireTeamAccess(bob, scope)).rejects.toThrow();
    const other = await createTeam(alice, scope.organizationId, "Restrita", "");
    await db.execute(
      sql`DELETE FROM team_members WHERE team_id=${other.teamId}`,
    );
    await expect(requireTeamAccess(alice, other)).rejects.toThrow();
    await expect(joinTeamAsAdmin(bob, other)).rejects.toThrow();
    await joinTeamAsAdmin(alice, other);
    expect(await requireTeamAccess(alice, other)).toBe("manager");
    expect(
      await rows(
        sql`SELECT id FROM audit_events WHERE action='admin.joined_team' AND target_id=${other.teamId}`,
      ),
    ).toHaveLength(1);
  });
  it("accepts an invitation once and revokes sources after removing a member", async () => {
    const link = await inviteMember(alice, scope, "bob@example.test", "member");
    const token = link.split("/").at(-1)!;
    await expect(acceptInvitation(alice, token)).rejects.toThrow();
    await acceptInvitation(bob, token);
    await expect(acceptInvitation(bob, token)).rejects.toThrow();
    expect(await requireTeamAccess(bob, scope)).toBe("member");
    await changeMember(alice, scope, bob.userId, "remove");
    await expect(requireTeamAccess(bob, scope)).rejects.toThrow();
  });
  it("keeps conversations private and rejects stale step results", async () => {
    await db.execute(
      sql`INSERT INTO team_members VALUES (${scope.organizationId},${scope.teamId},'bob','member')`,
    );
    const [c] = await rows<{ id: string }>(
      sql`INSERT INTO conversations(organization_id,team_id,author_id,title) VALUES (${scope.organizationId},${scope.teamId},'alice','Privada') RETURNING id`,
    );
    await expect(ownConversation(bob, scope, c.id)).rejects.toThrow();
    const [step] = await rows<{ id: string }>(
      sql`INSERT INTO guided_steps(conversation_id,instruction) VALUES (${c.id},'Verifique a rede') RETURNING id`,
    );
    await recordStepResult(alice, scope, { stepId: step.id, result: "failed" });
    await expect(
      recordStepResult(alice, scope, { stepId: step.id, result: "worked" }),
    ).rejects.toThrow();
    expect(
      (
        await rows<{ result: string }>(
          sql`SELECT result FROM guided_steps WHERE id=${step.id}`,
        )
      )[0].result,
    ).toBe("failed");
    expect(
      (
        await rows<{ content: string }>(
          sql`SELECT content FROM messages WHERE conversation_id=${c.id}`,
        )
      )[0].content,
    ).toContain("Verifique a rede");
  });
  it("requires confirmation, deduplicates and limits request visibility and assignment", async () => {
    const input = {
      title: "Acesso indisponível",
      summary: "Resumo explicitamente compartilhado.",
      confirmationId: crypto.randomUUID(),
      confirmed: true,
    };
    await expect(
      createRequest(bob, scope, { ...input, confirmed: false }),
    ).rejects.toThrow();
    const request = await createRequest(bob, scope, input);
    expect(await createRequest(bob, scope, input)).toEqual(request);
    await expect(
      updateRequest(alice, scope, { id: request.id, status: "closed" }),
    ).rejects.toThrow();
    await expect(
      updateRequest(alice, scope, { id: request.id, assigneeId: "bob" }),
    ).rejects.toThrow();
    await updateRequest(alice, scope, {
      id: request.id,
      assigneeId: "alice",
      status: "resolved",
      comment: "Orientação fornecida.",
    });
    await updateRequest(bob, scope, { id: request.id, status: "closed" });
    await updateRequest(bob, scope, { id: request.id, status: "open" });
    expect(
      (
        await rows<{ status: string }>(
          sql`SELECT status FROM requests WHERE id=${request.id}`,
        )
      )[0].status,
    ).toBe("open");
    await changeMember(alice, scope, "bob", "remove");
    await expect(
      updateRequest(bob, scope, { id: request.id, comment: "acesso revogado" }),
    ).rejects.toThrow();
  });
  it("makes deleted evidence immediately inaccessible and queues private-file cleanup", async () => {
    const [d] = await rows<{ id: string }>(
      sql`INSERT INTO documents(organization_id,team_id,title,object_key,format,size,status,created_by) VALUES (${scope.organizationId},${scope.teamId},'Manual','private-key','txt',10,'ready','alice') RETURNING id`,
    );
    const [c] = await rows<{ id: string }>(
      sql`INSERT INTO chunks(document_id,location,content) VALUES (${d.id},'Parágrafo 1','conteúdo privado') RETURNING id`,
    );
    expect((await getSource(alice, scope, c.id)).excerpt).toBe(
      "conteúdo privado",
    );
    await expect(getSource(bob, scope, c.id)).rejects.toThrow();
    await deleteDocument(alice, scope, d.id);
    await expect(getSource(alice, scope, c.id)).rejects.toThrow();
    expect(
      (
        await rows(
          sql`SELECT id FROM jobs WHERE document_id=${d.id} AND kind='delete'`,
        )
      ).length,
    ).toBe(1);
    await expect(retryDocument(alice, scope, d.id)).rejects.toThrow();
  });
});
