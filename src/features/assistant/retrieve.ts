import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { requireTeamAccess } from "@/lib/access";
import { embed } from "./provider";
import type { Actor, Scope, Source } from "@/lib/types";
export async function retrieve(
  actor: Actor,
  scope: Scope,
  query: string,
): Promise<Source[]> {
  await requireTeamAccess(actor, scope);
  const [vector] = await embed([query]);
  return rows<Source>(
    sql`SELECT c.id AS "chunkId",d.id AS "documentId",d.title,c.location,c.content AS excerpt FROM chunks c JOIN documents d ON d.id=c.document_id WHERE d.organization_id=${scope.organizationId} AND d.team_id=${scope.teamId} AND d.status='ready' AND c.embedding IS NOT NULL ORDER BY c.embedding <=> ${JSON.stringify(vector)}::vector LIMIT 6`,
  );
}
