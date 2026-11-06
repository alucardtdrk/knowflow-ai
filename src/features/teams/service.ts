import { randomBytes, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, rows } from "@/lib/db";
import { requireAdmin, requireTeamAccess } from "@/lib/access";
import { assertInvitation } from "@/lib/policy";
import { AppError } from "@/lib/errors";
import type { Actor, Scope, TeamRole } from "@/lib/types";

import type { PendingInvitation } from "@/lib/workspace";

export async function listPendingInvitations(actor: Actor) {
  return rows<PendingInvitation>(
    sql`SELECT i.id,i.team_id AS "teamId",t.name AS "teamName",o.name AS "organizationName",i.role FROM invitations i JOIN teams t ON t.id=i.team_id AND t.organization_id=i.organization_id JOIN organizations o ON o.id=i.organization_id JOIN "user" u ON lower(u.email)=lower(i.email) WHERE u.id=${actor.userId} AND i.accepted_at IS NULL AND i.expires_at>now() ORDER BY o.name,t.name`,
  );
}

const nameSchema = z.string().trim().min(2).max(80);
export async function joinTeamAsAdmin(actor: Actor, scope: Scope) {
  await requireAdmin(actor, scope.organizationId);
  await getDb().transaction(async (tx) => {
    const [team] = await rows(
      sql`SELECT id FROM teams WHERE id=${scope.teamId} AND organization_id=${scope.organizationId}`,
      tx,
    );
    if (!team) throw new AppError("Equipe indisponível.", 404);
    await tx.execute(
      sql`INSERT INTO team_members VALUES (${scope.organizationId},${scope.teamId},${actor.userId},'manager') ON CONFLICT DO NOTHING`,
    );
    await tx.execute(
      sql`INSERT INTO audit_events(organization_id,actor_id,action,target_id) VALUES (${scope.organizationId},${actor.userId},'admin.joined_team',${scope.teamId})`,
    );
  });
}
export async function createOrganization(actor: Actor, name: string) {
  name = nameSchema.parse(name);
  return getDb().transaction(async (tx) => {
    const [org] = await rows<{ id: string }>(
      sql`INSERT INTO organizations(name) VALUES (${name}) RETURNING id`,
      tx,
    );
    await tx.execute(
      sql`INSERT INTO organization_members VALUES (${org.id},${actor.userId},'admin')`,
    );
    const [team] = await rows<{ id: string }>(
      sql`INSERT INTO teams(organization_id,name,description) VALUES (${org.id},'Geral','Conhecimento compartilhado da equipe') RETURNING id`,
      tx,
    );
    await tx.execute(
      sql`INSERT INTO team_members VALUES (${org.id},${team.id},${actor.userId},'manager')`,
    );
    return { organizationId: org.id, teamId: team.id };
  });
}
export async function createTeam(
  actor: Actor,
  organizationId: string,
  name: string,
  description: string,
) {
  await requireAdmin(actor, organizationId);
  name = nameSchema.parse(name);
  description = z.string().trim().max(240).parse(description);
  return getDb().transaction(async (tx) => {
    const [team] = await rows<{ id: string }>(
      sql`INSERT INTO teams(organization_id,name,description) VALUES (${organizationId},${name},${description}) RETURNING id`,
      tx,
    );
    await tx.execute(
      sql`INSERT INTO team_members VALUES (${organizationId},${team.id},${actor.userId},'manager')`,
    );
    await tx.execute(
      sql`INSERT INTO audit_events(organization_id,actor_id,action,target_id) VALUES (${organizationId},${actor.userId},'team.created',${team.id})`,
    );
    return { organizationId, teamId: team.id };
  });
}
export async function inviteMember(
  actor: Actor,
  scope: Scope,
  email: string,
  role: TeamRole,
) {
  await requireTeamAccess(actor, scope, "manager");
  email = z.email().max(254).parse(email.trim().toLowerCase());
  role = z.enum(["manager", "member"]).parse(role);
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  await getDb().transaction(async (tx) => {
    await tx.execute(
      sql`INSERT INTO invitations(organization_id,team_id,email,role,token_hash,expires_at) VALUES (${scope.organizationId},${scope.teamId},${email},${role},${hash},now()+interval '7 days')`,
    );
    await tx.execute(
      sql`INSERT INTO audit_events(organization_id,actor_id,action,target_id) VALUES (${scope.organizationId},${actor.userId},'member.invited',${scope.teamId})`,
    );
  });
  return `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/invite/${token}`;
}
export async function acceptInvitation(actor: Actor, token: string) {
  z.union([z.string().regex(/^[a-f0-9]{64}$/), z.uuid()]).parse(token);
  const byId = z.uuid().safeParse(token).success;
  const hash = createHash("sha256").update(token).digest("hex");
  return getDb().transaction(async (tx) => {
    const [invite] = await rows<
      Scope & {
        id: string;
        email: string;
        role: TeamRole;
        expiresAt: Date;
        acceptedAt: Date | null;
      }
    >(
      sql`SELECT id,organization_id AS "organizationId",team_id AS "teamId",email,role,expires_at AS "expiresAt",accepted_at AS "acceptedAt" FROM invitations WHERE ${byId ? sql`id=${token}` : sql`token_hash=${hash}`} FOR UPDATE`,
      tx,
    );
    const [user] = await rows<{ email: string }>(
      sql`SELECT email FROM "user" WHERE id=${actor.userId}`,
      tx,
    );
    if (!invite || !user) throw new AppError("Convite não encontrado.", 404);
    assertInvitation(invite, user.email);
    await tx.execute(
      sql`INSERT INTO organization_members VALUES (${invite.organizationId},${actor.userId},'member') ON CONFLICT DO NOTHING`,
    );
    await tx.execute(
      sql`INSERT INTO team_members VALUES (${invite.organizationId},${invite.teamId},${actor.userId},${invite.role}) ON CONFLICT DO NOTHING`,
    );
    await tx.execute(
      sql`UPDATE invitations SET accepted_at=now() WHERE id=${invite.id}`,
    );
    await tx.execute(
      sql`INSERT INTO audit_events(organization_id,actor_id,action,target_id) VALUES (${invite.organizationId},${actor.userId},'invitation.accepted',${invite.id})`,
    );
    return { organizationId: invite.organizationId, teamId: invite.teamId };
  });
}
export async function changeMember(
  actor: Actor,
  scope: Scope,
  userId: string,
  role: TeamRole | "remove",
) {
  await requireTeamAccess(actor, scope, "manager");
  role = z.enum(["manager", "member", "remove"]).parse(role);
  await getDb().transaction(async (tx) => {
    const members = await rows<{ user_id: string; role: string }>(
      sql`SELECT user_id,role FROM team_members WHERE team_id=${scope.teamId} AND organization_id=${scope.organizationId} FOR UPDATE`,
      tx,
    );
    if (
      members.find((m) => m.user_id === userId)?.role === "manager" &&
      role !== "manager" &&
      members.filter((m) => m.role === "manager").length === 1
    )
      throw new AppError("A equipe precisa de pelo menos um gestor.");
    if (role === "remove") {
      await tx.execute(
        sql`DELETE FROM team_members WHERE team_id=${scope.teamId} AND user_id=${userId}`,
      );
      await tx.execute(
        sql`UPDATE requests SET assignee_id=NULL WHERE team_id=${scope.teamId} AND assignee_id=${userId}`,
      );
    } else {
      await tx.execute(
        sql`UPDATE team_members SET role=${role} WHERE team_id=${scope.teamId} AND user_id=${userId}`,
      );
      if (role === "member")
        await tx.execute(
          sql`UPDATE requests SET assignee_id=NULL WHERE team_id=${scope.teamId} AND assignee_id=${userId}`,
        );
    }
    await tx.execute(
      sql`INSERT INTO audit_events(organization_id,actor_id,action,target_id) VALUES (${scope.organizationId},${actor.userId},${`member.${role}`},${userId})`,
    );
  });
}
