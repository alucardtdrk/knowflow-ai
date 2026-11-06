import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { getAuth } from "./auth";
import { rows } from "./db";
import { AppError } from "./errors";
import { assertTeamAccess } from "./policy";
import type { Actor, Scope, TeamRole } from "./types";

export async function requireActor(): Promise<Actor> {
  let session;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
  } catch {
    throw new AppError(
      "Não foi possível validar sua sessão. Tente novamente.",
      503,
    );
  }
  if (!session) throw new AppError("Entre na sua conta para continuar.", 401);
  return { userId: session.user.id };
}
export async function requireTeamAccess(
  actor: Actor,
  scope: Scope,
  role?: "manager",
): Promise<TeamRole> {
  const [membership] = await rows<Scope & { role: TeamRole }>(sql`
    SELECT organization_id AS "organizationId", team_id AS "teamId", role FROM team_members
    WHERE user_id=${actor.userId} AND organization_id=${scope.organizationId} AND team_id=${scope.teamId}`);
  assertTeamAccess(scope, membership, role);
  return membership.role;
}
export async function requireAdmin(actor: Actor, organizationId: string) {
  const [member] = await rows(
    sql`SELECT user_id FROM organization_members WHERE organization_id=${organizationId} AND user_id=${actor.userId} AND role='admin'`,
  );
  if (!member)
    throw new AppError(
      "Apenas administradores podem gerenciar a organização.",
      403,
    );
}
