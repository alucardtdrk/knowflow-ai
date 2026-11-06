import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { requireTeamAccess } from "@/lib/access";
import type { Actor, Scope, Source } from "@/lib/types";
export async function retrieve(
  actor: Actor,
  scope: Scope,
  query: string,
): Promise<Source[]> {
  await requireTeamAccess(actor, scope);
  // shortcut: lexical search does not infer synonyms; add semantic search if recall becomes insufficient.
  const terms = (query.match(/[\p{L}\p{N}]+/gu) || [])
    .slice(0, 64)
    .join(" OR ");
  if (!terms) return [];
  return rows<Source>(
    sql`SELECT c.id AS "chunkId",d.id AS "documentId",d.title,c.location,c.content AS excerpt
    FROM chunks c JOIN documents d ON d.id=c.document_id,
      websearch_to_tsquery('portuguese', ${terms}) q
    WHERE d.organization_id=${scope.organizationId} AND d.team_id=${scope.teamId} AND d.status='ready'
      AND to_tsvector('portuguese', d.title || ' ' || c.content) @@ q
    ORDER BY ts_rank(to_tsvector('portuguese', d.title || ' ' || c.content), q) DESC, c.id
    LIMIT 6`,
  );
}
