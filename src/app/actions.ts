"use server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { rows } from "@/lib/db";
import { requireActor, requireTeamAccess } from "@/lib/access";
import type { Scope, TeamRole, RequestStatus, Source } from "@/lib/types";
import type { WorkspaceData, MessageItem } from "@/lib/workspace";
import {
  answer,
  recordStepResult,
  ownConversation,
  deleteConversation,
} from "@/features/assistant/service";
import {
  uploadDocument,
  deleteDocument,
  retryDocument,
  getSource,
} from "@/features/documents/service";
import { createRequest, updateRequest } from "@/features/requests/service";
import {
  listPendingInvitations,
  createOrganization,
  createTeam,
  inviteMember,
  acceptInvitation,
  changeMember,
  joinTeamAsAdmin,
} from "@/features/teams/service";
import { AppError } from "@/lib/errors";

const scopeSchema = z.object({ organizationId: z.uuid(), teamId: z.uuid() });
async function safe<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError)
      return { ok: false, error: "Confira os campos e tente novamente." };
    console.error("Operação indisponível", {
      type: e instanceof Error ? e.name : "Unknown",
    });
    return {
      ok: false,
      error:
        "Não foi possível concluir. Confira a configuração do servidor e tente novamente.",
    };
  }
}
export async function loadWorkspace(
  teamId: string,
  page = 1,
  conversationId?: string,
): Promise<WorkspaceData> {
  z.number().int().min(1).max(1000000).parse(page);
  if (conversationId) z.uuid().parse(conversationId);
  z.uuid().parse(teamId);
  const actor = await requireActor();
  const teams = await rows<Scope & { name: string; organizationName: string }>(
    sql`SELECT t.id AS "teamId",t.organization_id AS "organizationId",t.name,o.name AS "organizationName" FROM teams t JOIN team_members m ON m.team_id=t.id AND m.organization_id=t.organization_id JOIN organizations o ON o.id=t.organization_id WHERE m.user_id=${actor.userId} ORDER BY o.name,t.name`,
  );
  const team = teams.find((t) => t.teamId === teamId);
  if (!team) throw new AppError("Equipe indisponível.", 403);
  const scope = { organizationId: team.organizationId, teamId };
  const role = await requireTeamAccess(actor, scope);
  const [user] = await rows<WorkspaceData["user"]>(
    sql`SELECT id,name,email FROM "user" WHERE id=${actor.userId}`,
  );
  const [org] = await rows<{ role: string }>(
    sql`SELECT role FROM organization_members WHERE organization_id=${scope.organizationId} AND user_id=${actor.userId}`,
  );
  const [detail] = await rows<{ description: string }>(
    sql`SELECT description FROM teams WHERE id=${teamId}`,
  );
  const documents = await rows<WorkspaceData["documents"][number]>(
    sql`SELECT id,title,format,size,status,error,created_at::text AS "createdAt" FROM documents WHERE team_id=${teamId} AND organization_id=${scope.organizationId} AND status<>'deleted' ORDER BY created_at DESC`,
  );
  const [conversationCount] = await rows<{ total: number }>(
    sql`SELECT count(*)::int AS total FROM conversations WHERE team_id=${teamId} AND organization_id=${scope.organizationId} AND author_id=${actor.userId}`,
  );
  page = Math.min(page, Math.max(1, Math.ceil(conversationCount.total / 10)));
  if (conversationId) await ownConversation(actor, scope, conversationId);
  const conversations = await rows<WorkspaceData["conversations"][number]>(
    sql`SELECT c.id,c.title,(SELECT left(m.content,120) FROM messages m WHERE m.conversation_id=c.id ORDER BY m.sequence DESC LIMIT 1) AS preview FROM conversations c WHERE c.team_id=${teamId} AND c.organization_id=${scope.organizationId} AND c.author_id=${actor.userId} ORDER BY c.created_at DESC,c.id DESC LIMIT 10 OFFSET ${(page - 1) * 10}`,
  );
  for (const c of conversations) {
    c.messages = [];
    c.steps = [];
    if (c.id !== conversationId) continue;
    const messages = await rows<MessageItem & { sourceIds: string[] }>(
      sql`SELECT id,role,content,source_ids AS "sourceIds" FROM messages WHERE conversation_id=${c.id} ORDER BY sequence`,
    );
    c.messages = [];
    for (const m of messages) {
      const sources: Source[] = [];
      for (const id of m.sourceIds) {
        try {
          sources.push(await getSource(actor, scope, id));
        } catch (e) {
          if (!(e instanceof AppError) || e.status !== 404) throw e;
        }
      }
      c.messages.push({
        id: m.id,
        role: m.role,
        content: m.content,
        sources,
        unavailableCount: m.sourceIds.length - sources.length,
      });
    }
    c.steps = await rows(
      sql`SELECT id,instruction,result FROM guided_steps WHERE conversation_id=${c.id} ORDER BY created_at,id`,
    );
  }
  const requests = await rows<WorkspaceData["requests"][number]>(
    sql`SELECT r.id,r.title,r.summary,r.status,r.author_id AS "authorId",u.name AS "authorName",r.assignee_id AS "assigneeId",r.created_at::text AS "createdAt" FROM requests r JOIN "user" u ON u.id=r.author_id WHERE r.team_id=${teamId} AND r.organization_id=${scope.organizationId} AND (${role}='manager' OR r.author_id=${actor.userId}) ORDER BY r.created_at DESC LIMIT 100`,
  );
  for (const r of requests)
    r.comments = await rows(
      sql`SELECT c.id,u.name AS author,c.content FROM request_comments c JOIN "user" u ON u.id=c.author_id WHERE c.request_id=${r.id} ORDER BY c.created_at,c.id`,
    );
  const members = await rows<WorkspaceData["members"][number]>(
    sql`SELECT u.id,u.name,u.email,m.role FROM team_members m JOIN "user" u ON u.id=m.user_id WHERE m.team_id=${teamId} AND m.organization_id=${scope.organizationId} ORDER BY u.name`,
  );
  const organizationTeams =
    org?.role === "admin"
      ? await rows<{ id: string; name: string; joined: boolean }>(
          sql`SELECT t.id,t.name,EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=t.id AND m.user_id=${actor.userId}) AS joined FROM teams t WHERE t.organization_id=${scope.organizationId} ORDER BY t.name`,
        )
      : [];
  return {
    scope,
    user,
    role,
    isAdmin: org?.role === "admin",
    organizationTeams,
    invitations: await listPendingInvitations(actor),
    organizationName: team.organizationName,
    teamName: team.name,
    teamDescription: detail.description,
    teams,
    documents,
    conversations,
    conversationPage: page,
    conversationTotal: conversationCount.total,
    requests,
    members,
  };
}
export async function askAction(
  scope: Scope,
  input: { conversationId?: string; message: string },
) {
  return safe(async () =>
    answer(await requireActor(), scopeSchema.parse(scope), input),
  );
}
export async function stepAction(
  scope: Scope,
  input: { stepId: string; result: "worked" | "failed" | "unable" },
) {
  return safe(async () =>
    recordStepResult(await requireActor(), scopeSchema.parse(scope), input),
  );
}
export async function uploadAction(scope: Scope, form: FormData) {
  return safe(async () => {
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("Selecione um arquivo.");
    return uploadDocument(await requireActor(), scopeSchema.parse(scope), file);
  });
}
export async function documentAction(
  scope: Scope,
  id: string,
  action: "delete" | "retry",
) {
  return safe(async () => {
    z.uuid().parse(id);
    z.enum(["delete", "retry"]).parse(action);
    return action === "delete"
      ? deleteDocument(await requireActor(), scopeSchema.parse(scope), id)
      : retryDocument(await requireActor(), scopeSchema.parse(scope), id);
  });
}
export async function requestAction(
  scope: Scope,
  input: {
    confirmationId: string;
    title: string;
    summary: string;
    conversationId?: string;
    confirmed: boolean;
  },
) {
  return safe(async () =>
    createRequest(await requireActor(), scopeSchema.parse(scope), input),
  );
}
export async function updateRequestAction(
  scope: Scope,
  input: {
    id: string;
    status?: RequestStatus;
    assigneeId?: string | null;
    comment?: string;
  },
) {
  return safe(async () =>
    updateRequest(await requireActor(), scopeSchema.parse(scope), input),
  );
}
export async function organizationAction(name: string) {
  return safe(async () => createOrganization(await requireActor(), name));
}
export async function teamAction(
  organizationId: string,
  name: string,
  description: string,
) {
  return safe(async () =>
    createTeam(
      await requireActor(),
      z.uuid().parse(organizationId),
      name,
      description,
    ),
  );
}
export async function inviteAction(
  scope: Scope,
  email: string,
  role: TeamRole,
) {
  return safe(async () =>
    inviteMember(await requireActor(), scopeSchema.parse(scope), email, role),
  );
}
export async function acceptInviteAction(token: string) {
  return safe(async () => acceptInvitation(await requireActor(), token));
}
export async function memberAction(
  scope: Scope,
  userId: string,
  role: TeamRole | "remove",
) {
  return safe(async () =>
    changeMember(await requireActor(), scopeSchema.parse(scope), userId, role),
  );
}
export async function joinTeamAction(scope: Scope) {
  return safe(async () =>
    joinTeamAsAdmin(await requireActor(), scopeSchema.parse(scope)),
  );
}

export async function deleteConversationAction(scope: Scope, id: string) {
  return safe(async () =>
    deleteConversation(
      await requireActor(),
      scopeSchema.parse(scope),
      z.uuid().parse(id),
    ),
  );
}
