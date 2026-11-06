import type { ConversationItem } from "./workspace";

export function buildRequestSummary(conversation: ConversationItem) {
  const questions = conversation.messages.filter((m) => m.role === "user");
  const lastAnswer = conversation.messages.findLast(
    (m) => m.role === "assistant",
  );
  const sources = Array.from(
    new Map(
      conversation.messages
        .flatMap((m) => m.sources)
        .map((s) => [s.chunkId, s]),
    ).values(),
  );
  const results: Record<string, string> = {
    worked: "Funcionou",
    failed: "Não resolveu",
    unable: "Não foi possível realizar",
  };
  return [
    `Problema: ${questions[0]?.content || conversation.title}`,
    ...questions.slice(1).map((m) => `Contexto informado: ${m.content}`),
    ...conversation.steps
      .filter((s) => s.result)
      .map(
        (s) =>
          `Etapa: ${s.instruction}\nResultado: ${results[s.result!] || s.result}`,
      ),
    lastAnswer
      ? `Última orientação / lacunas: ${lastAnswer.content}`
      : "Lacunas: ainda não há orientação documental.",
    sources.length
      ? `Fontes consultadas:\n${sources.map((s) => `${s.title} — ${s.location}`).join("\n")}`
      : "Fontes: nenhuma evidência disponível para confirmar a orientação.",
    conversation.messages.some((m) => m.unavailableCount)
      ? "Algumas fontes anteriores estão indisponíveis."
      : null,
    "Contexto adicional: ",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000);
}
