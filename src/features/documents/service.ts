import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/lib/db";
import { requireTeamAccess } from "@/lib/access";
import type { Actor, Scope, Source } from "@/lib/types";
import { AppError } from "@/lib/errors";
import { validateFile } from "./extract";
import { putObject, deleteObject, getObject } from "./storage";

export async function uploadDocument(actor: Actor, scope: Scope, file: File) {
  await requireTeamAccess(actor, scope, "manager");
  if (file.size > 20 * 1024 * 1024)
    throw new AppError("O limite é 20 MB por arquivo.");
  const data = new Uint8Array(await file.arrayBuffer());
  const format = validateFile(file.name, data);
  const id = randomUUID();
  const key = `${scope.organizationId}/${scope.teamId}/${id}`;
  await putObject(key, data);
  try {
    await requireTeamAccess(actor, scope, "manager");
    await getDb().transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO documents(id,organization_id,team_id,title,object_key,format,size,created_by) VALUES (${id},${scope.organizationId},${scope.teamId},${file.name.slice(0, 180)},${key},${format},${file.size},${actor.userId})`,
      );
      await tx.execute(sql`INSERT INTO jobs(document_id) VALUES (${id})`);
    });
  } catch (error) {
    await deleteObject(key).catch(() =>
      console.error("Falha ao remover upload incompleto", { documentId: id }),
    );
    throw error;
  }
  return { id };
}
export async function deleteDocument(actor: Actor, scope: Scope, id: string) {
  await requireTeamAccess(actor, scope, "manager");
  await getDb().transaction(async (tx) => {
    const [doc] = await rows(
      sql`UPDATE documents SET status='deleted',error=NULL WHERE id=${id} AND team_id=${scope.teamId} AND organization_id=${scope.organizationId} AND status<>'deleted' RETURNING id`,
      tx,
    );
    if (!doc) throw new AppError("Documento não encontrado.", 404);
    await tx.execute(sql`DELETE FROM chunks WHERE document_id=${id}`);
    await tx.execute(
      sql`INSERT INTO jobs(document_id,kind) VALUES (${id},'delete')`,
    );
    await tx.execute(
      sql`INSERT INTO audit_events(organization_id,actor_id,action,target_id) VALUES (${scope.organizationId},${actor.userId},'document.deleted',${id})`,
    );
  });
}
export async function retryDocument(actor: Actor, scope: Scope, id: string) {
  await requireTeamAccess(actor, scope, "manager");
  await getDb().transaction(async (tx) => {
    const [doc] = await rows(
      sql`UPDATE documents SET status='pending',error=NULL WHERE id=${id} AND team_id=${scope.teamId} AND organization_id=${scope.organizationId} AND status='failed' RETURNING id`,
      tx,
    );
    if (!doc)
      throw new AppError(
        "Somente documentos com falha podem ser reprocessados.",
      );
    await tx.execute(sql`INSERT INTO jobs(document_id) VALUES (${id})`);
  });
}
export async function getSource(
  actor: Actor,
  scope: Scope,
  chunkId: string,
): Promise<Source> {
  await requireTeamAccess(actor, scope);
  const [source] = await rows<Source>(
    sql`SELECT c.id AS "chunkId",d.id AS "documentId",d.title,c.location,c.content AS excerpt FROM chunks c JOIN documents d ON d.id=c.document_id WHERE c.id=${chunkId} AND d.team_id=${scope.teamId} AND d.organization_id=${scope.organizationId} AND d.status='ready'`,
  );
  if (!source) throw new AppError("Esta fonte não está mais disponível.", 404);
  return source;
}
export async function downloadDocument(actor: Actor, scope: Scope, id: string) {
  await requireTeamAccess(actor, scope);
  const [doc] = await rows<{ title: string; object_key: string }>(
    sql`SELECT title,object_key FROM documents WHERE id=${id} AND team_id=${scope.teamId} AND organization_id=${scope.organizationId} AND status<>'deleted'`,
  );
  if (!doc) throw new AppError("Documento não encontrado.", 404);
  const data = await getObject(doc.object_key);
  await requireTeamAccess(actor, scope);
  return { title: doc.title, data };
}
