import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getObject, deleteObject } from "./storage";
import { extractDocument, type Format } from "./extract";

export async function processNextJob(): Promise<boolean> {
  const claimId = randomUUID();
  const [job] = await rows<{
    id: string;
    document_id: string;
    kind: "ingest" | "delete";
    attempts: number;
  }>(sql`
    UPDATE jobs SET status='processing',attempts=attempts+1,lease_until=now()+interval '10 minutes',claim_id=${claimId}
    WHERE id=(SELECT id FROM jobs WHERE (status='pending' OR (status='processing' AND lease_until<now())) AND attempts<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id,document_id,kind,attempts`);
  if (!job) {
    await getDb().execute(
      sql`UPDATE documents SET status='failed',error='Processamento interrompido. Tente novamente.' WHERE status='processing' AND id IN (SELECT document_id FROM jobs WHERE status='processing' AND lease_until<now() AND attempts>=3 AND kind='ingest')`,
    );
    await getDb().execute(
      sql`UPDATE jobs SET status='failed' WHERE status='processing' AND lease_until<now() AND attempts>=3`,
    );
    return false;
  }
  try {
    const [doc] = await rows<{
      object_key: string;
      format: Format;
      status: string;
    }>(
      sql`SELECT object_key,format,status FROM documents WHERE id=${job.document_id}`,
    );
    if (job.kind === "delete") {
      if (doc) await deleteObject(doc.object_key);
    } else if (doc && doc.status !== "deleted") {
      await getDb().execute(
        sql`UPDATE documents SET status='processing' WHERE id=${job.document_id} AND status<>'deleted'`,
      );
      const chunks = await extractDocument(
        await getObject(doc.object_key),
        doc.format,
      );
      const [claimed] = await rows(
        sql`UPDATE jobs SET lease_until=now()+interval '10 minutes' WHERE id=${job.id} AND claim_id=${claimId} RETURNING id`,
      );
      if (!claimed) return true;
      await getDb().transaction(async (tx) => {
        const [active] = await rows(
          sql`SELECT id FROM jobs WHERE id=${job.id} AND claim_id=${claimId} FOR UPDATE`,
          tx,
        );
        if (!active) return;
        const [current] = await rows(
          sql`SELECT id FROM documents WHERE id=${job.document_id} AND status<>'deleted' FOR UPDATE`,
          tx,
        );
        if (!current) return;
        await tx.execute(
          sql`DELETE FROM chunks WHERE document_id=${job.document_id}`,
        );
        for (let i = 0; i < chunks.length; i++)
          await tx.execute(
            sql`INSERT INTO chunks(document_id,location,content) VALUES (${job.document_id},${chunks[i].location},${chunks[i].content})`,
          );
        await tx.execute(
          sql`UPDATE documents SET status='ready',error=NULL WHERE id=${job.document_id}`,
        );
      });
    }
    await getDb().execute(
      sql`UPDATE jobs SET status='done',lease_until=NULL WHERE id=${job.id} AND claim_id=${claimId}`,
    );
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : "Não foi possível processar o arquivo. Confira o formato e a configuração do servidor.";
    await getDb().transaction(async (tx) => {
      const [active] = await rows(
        sql`UPDATE jobs SET status=${job.attempts < 3 ? "pending" : "failed"},lease_until=NULL WHERE id=${job.id} AND claim_id=${claimId} RETURNING id`,
        tx,
      );
      if (active && job.kind === "ingest")
        await tx.execute(
          sql`UPDATE documents SET status=${job.attempts < 3 ? "pending" : "failed"},error=${message} WHERE id=${job.document_id} AND status<>'deleted'`,
        );
    });
    console.error("Falha no trabalho", {
      jobId: job.id,
      attempt: job.attempts,
    });
  }
  return true;
}
