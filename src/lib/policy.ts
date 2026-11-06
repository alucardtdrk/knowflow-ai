import { AppError } from "./errors";
import type { Scope, TeamRole, RequestStatus } from "./types";

export function assertTeamAccess(
  scope: Scope,
  membership: (Scope & { role: TeamRole }) | null | undefined,
  role?: "manager",
) {
  if (
    !membership ||
    membership.organizationId !== scope.organizationId ||
    membership.teamId !== scope.teamId ||
    (role && membership.role !== role)
  ) {
    throw new AppError("Você não tem acesso a esta equipe.", 403);
  }
}
export function assertInvitation(
  invite: { email: string; expiresAt: Date; acceptedAt: Date | null },
  email: string,
  now = new Date(),
) {
  if (
    invite.email.toLowerCase() !== email.toLowerCase() ||
    invite.acceptedAt ||
    invite.expiresAt <= now
  )
    throw new AppError("Convite inválido, expirado ou já utilizado.", 403);
}
export function assertRequestAccess(
  authorId: string,
  userId: string,
  role: TeamRole,
) {
  if (authorId !== userId && role !== "manager")
    throw new AppError("Solicitação não disponível.", 403);
}
export function assertTransition(
  authorId: string,
  userId: string,
  role: TeamRole,
  next: RequestStatus,
) {
  assertRequestAccess(authorId, userId, role);
  if (
    next === "closed" || next === "open"
      ? authorId !== userId
      : role !== "manager"
  )
    throw new AppError("Você não pode fazer essa alteração.", 403);
}
