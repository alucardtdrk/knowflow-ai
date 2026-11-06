import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, rows } from "@/lib/db";
import { requireTeamAccess } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { assertRequestAccess, assertTransition } from "@/lib/policy";
import type { Actor, Scope, RequestStatus } from "@/lib/types";
import { ownConversation } from "@/features/assistant/service";

export async function createRequest(
  actor: Actor,
  scope: Scope,
  input: {
    confirmationId: string;
    title: string;
    summary: string;
    conversationId?: string;
    confirmed?: boolean;
  },
) {
  const value = z
    .object({
      confirmationId: z.uuid(),
      title: z.string().trim().min(3).max(120),
      summary: z.string().trim().min(10).max(8000),
      conversationId: z.uuid().optional(),
      confirmed: z.literal(true),
    })
    .parse(input);
  await requireTeamAccess(actor, scope);
  if (value.conversationId)
    await ownConversation(actor, scope, value.conversationId);
  const [request] = await rows<{
    id: string;
    team_id: string;
    organization_id: string;
  }>(
    sql`INSERT INTO requests(organization_id,team_id,author_id,title,summary,confirmation_id) VALUES (${scope.organizationId},${scope.teamId},${actor.userId},${value.title},${value.summary},${value.confirmationId}) ON CONFLICT(author_id,confirmation_id) DO UPDATE SET confirmation_id=requests.confirmation_id RETURNING id,team_id,organization_id`,
  );
  if (
    request.team_id !== scope.teamId ||
    request.organization_id !== scope.organizationId
  )
    throw new AppError("Confirmação já utilizada em outra equipe.", 409);
  return { id: request.id };
}
export async function updateRequest(
  actor: Actor,
  scope: Scope,
  input: {
    id: string;
    status?: RequestStatus;
    assigneeId?: string | null;
    comment?: string;
  },
) {
  input = z
    .object({
      id: z.uuid(),
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      assigneeId: z.string().nullable().optional(),
      comment: z.string().trim().min(1).max(4000).optional(),
    })
    .parse(input);
  const role = await requireTeamAccess(actor, scope);
  await getDb().transaction(async (tx) => {
    const [request] = await rows<{ author_id: string }>(
      sql`SELECT author_id FROM requests WHERE id=${input.id} AND team_id=${scope.teamId} AND organization_id=${scope.organizationId} FOR UPDATE`,
      tx,
    );
    if (!request) throw new AppError("Solicitação não encontrada.", 404);
    assertRequestAccess(request.author_id, actor.userId, role);
    if (input.status) {
      assertTransition(request.author_id, actor.userId, role, input.status);
      await tx.execute(
        sql`UPDATE requests SET status=${input.status},updated_at=now() WHERE id=${input.id}`,
      );
    }
    if (input.assigneeId !== undefined) {
      if (role !== "manager")
        throw new AppError(
          "Somente gestores podem atribuir solicitações.",
          403,
        );
      if (input.assigneeId !== null) {
        const [manager] = await rows(
          sql`SELECT user_id FROM team_members WHERE user_id=${input.assigneeId} AND team_id=${scope.teamId} AND organization_id=${scope.organizationId} AND role='manager' FOR SHARE`,
          tx,
        );
        if (!manager) throw new AppError("Escolha um gestor desta equipe.");
      }
      await tx.execute(
        sql`UPDATE requests SET assignee_id=${input.assigneeId},updated_at=now() WHERE id=${input.id}`,
      );
    }
    if (input.comment) {
      await tx.execute(
        sql`INSERT INTO request_comments(request_id,author_id,content) VALUES (${input.id},${actor.userId},${input.comment})`,
      );
      await tx.execute(
        sql`UPDATE requests SET updated_at=now() WHERE id=${input.id}`,
      );
    }
  });
}
