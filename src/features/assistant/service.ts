import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, rows } from "@/lib/db";
import { requireTeamAccess } from "@/lib/access";
import { AppError } from "@/lib/errors";
import type { Actor, Scope } from "@/lib/types";
import { retrieve } from "./retrieve";
import { generate } from "./provider";

export async function ownConversation(actor: Actor, scope: Scope, id: string) {
  await requireTeamAccess(actor, scope);
  const [conversation] = await rows(
    sql`SELECT id FROM conversations WHERE id=${id} AND organization_id=${scope.organizationId} AND team_id=${scope.teamId} AND author_id=${actor.userId}`,
  );
  if (!conversation) throw new AppError("Conversa não encontrada.", 404);
}
export async function answer(
  actor: Actor,
  scope: Scope,
  input: { conversationId?: string; message: string },
) {
  input = z
    .object({
      conversationId: z.uuid().optional(),
      message: z.string().trim().min(2).max(4000),
    })
    .parse(input);
  await requireTeamAccess(actor, scope);
  let pendingStep: { id: string; instruction: string } | undefined;
  if (input.conversationId) {
    await ownConversation(actor, scope, input.conversationId);
    [pendingStep] = await rows<{ id: string; instruction: string }>(
      sql`SELECT id,instruction FROM guided_steps WHERE conversation_id=${input.conversationId} AND result IS NULL`,
    );
  }
  const [limit] = await rows(
    sql`INSERT INTO generation_limits(user_id,window_start,count) VALUES (${actor.userId},date_trunc('minute',now()),1) ON CONFLICT(user_id,window_start) DO UPDATE SET count=generation_limits.count+1 WHERE generation_limits.count<10 RETURNING count`,
  );
  if (!limit)
    throw new AppError(
      "Limite de 10 perguntas por minuto. Aguarde um momento.",
      429,
    );
  const history = input.conversationId
    ? await rows<{ role: "user" | "assistant"; content: string }>(
        sql`SELECT role,content FROM (SELECT role,content,sequence FROM messages WHERE conversation_id=${input.conversationId} ORDER BY sequence DESC LIMIT 12) h ORDER BY sequence`,
      )
    : [];
  if (pendingStep)
    history.push({
      role: "assistant",
      content: `Etapa aguardando resposta: ${pendingStep.instruction}`,
    });
  const [original] = input.conversationId
    ? await rows<{ title: string }>(
        sql`SELECT title FROM conversations WHERE id=${input.conversationId}`,
      )
    : [];
  const sources = await retrieve(
    actor,
    scope,
    original ? `${original.title}\n${input.message}` : input.message,
  );
  const result = await generate(input.message, sources, history);
  await requireTeamAccess(actor, scope);
  // The generation may outlive a document deletion; never persist stale evidence as available.
  const activeIds = await rows<{ id: string }>(
    sql`SELECT c.id FROM chunks c JOIN documents d ON d.id=c.document_id WHERE d.team_id=${scope.teamId} AND d.organization_id=${scope.organizationId} AND d.status='ready'`,
  );
  if (result.sources.some((s) => !activeIds.some((a) => a.id === s.chunkId)))
    throw new AppError("Uma fonte mudou durante a consulta. Tente novamente.");
  return getDb().transaction(async (tx) => {
    let conversationId = input.conversationId;
    if (!conversationId) {
      const [created] = await rows<{ id: string }>(
        sql`INSERT INTO conversations(organization_id,team_id,author_id,title) VALUES (${scope.organizationId},${scope.teamId},${actor.userId},${input.message.slice(0, 100)}) RETURNING id`,
        tx,
      );
      conversationId = created.id;
    } else {
      await tx.execute(
        sql`SELECT id FROM conversations WHERE id=${conversationId} FOR UPDATE`,
      );
      const [pending] = await rows<{ id: string }>(
        sql`SELECT id FROM guided_steps WHERE conversation_id=${conversationId} AND result IS NULL FOR UPDATE`,
        tx,
      );
      if (pending?.id !== pendingStep?.id)
        throw new AppError(
          "A etapa mudou durante a consulta. Atualize a conversa.",
          409,
        );
      if (pending)
        await tx.execute(
          sql`UPDATE guided_steps SET result='answered' WHERE id=${pending.id}`,
        );
    }
    await tx.execute(
      sql`INSERT INTO messages(conversation_id,role,content) VALUES (${conversationId},'user',${input.message})`,
    );
    await tx.execute(
      sql`INSERT INTO messages(conversation_id,role,content,source_ids) VALUES (${conversationId},'assistant',${result.text},${JSON.stringify(result.sources.map((s) => s.chunkId))}::jsonb)`,
    );
    let stepId: string | undefined;
    if (result.nextStep) {
      const [step] = await rows<{ id: string }>(
        sql`INSERT INTO guided_steps(conversation_id,instruction) VALUES (${conversationId},${result.nextStep}) RETURNING id`,
        tx,
      );
      stepId = step.id;
    }
    return {
      conversationId,
      text: result.text,
      sources: result.sources,
      stepId,
    };
  });
}
export async function recordStepResult(
  actor: Actor,
  scope: Scope,
  input: { stepId: string; result: "worked" | "failed" | "unable" },
) {
  input = z
    .object({
      stepId: z.uuid(),
      result: z.enum(["worked", "failed", "unable"]),
    })
    .parse(input);
  await requireTeamAccess(actor, scope);
  await getDb().transaction(async (tx) => {
    const [step] = await rows<{ conversation_id: string; instruction: string }>(
      sql`UPDATE guided_steps s SET result=${input.result} FROM conversations c WHERE s.id=${input.stepId} AND s.conversation_id=c.id AND c.author_id=${actor.userId} AND c.organization_id=${scope.organizationId} AND c.team_id=${scope.teamId} AND s.result IS NULL RETURNING s.conversation_id,s.instruction`,
      tx,
    );
    if (!step)
      throw new AppError(
        "Esta etapa já foi respondida ou não está disponível.",
        409,
      );
    const description = {
      worked: "A etapa funcionou.",
      failed: "A etapa não resolveu o problema.",
      unable: "Não consegui realizar a etapa.",
    }[input.result];
    await tx.execute(
      sql`INSERT INTO messages(conversation_id,role,content) VALUES (${step.conversation_id},'user',${`Etapa: ${step.instruction}\nResultado: ${description}`})`,
    );
  });
}

export async function deleteConversation(
  actor: Actor,
  scope: Scope,
  id: string,
) {
  z.uuid().parse(id);
  await requireTeamAccess(actor, scope);
  const [deleted] = await rows(
    sql`DELETE FROM conversations WHERE id=${id} AND organization_id=${scope.organizationId} AND team_id=${scope.teamId} AND author_id=${actor.userId} RETURNING id`,
  );
  if (!deleted) throw new AppError("Conversa não encontrada.", 404);
}
