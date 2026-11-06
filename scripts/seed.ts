import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { getAuth } from "../src/lib/auth";
import { rows, getDb } from "../src/lib/db";
import { createOrganization, createTeam } from "../src/features/teams/service";
import { uploadDocument } from "../src/features/documents/service";
import { ensureBucket } from "../src/features/documents/storage";
import { createRequest } from "../src/features/requests/service";

if (
  process.env.ALLOW_LOCAL_SEED !== "true" ||
  process.env.NODE_ENV === "production"
)
  throw new Error(
    "Seed permitido somente localmente com ALLOW_LOCAL_SEED=true.",
  );
const url = new URL(process.env.DATABASE_URL || "");
if (
  !["localhost", "127.0.0.1", "postgres"].includes(url.hostname) ||
  !["knowflow", "knowflow_demo"].includes(url.pathname.slice(1))
)
  throw new Error("Seed restrito ao banco local knowflow ou knowflow_demo.");
const password = "KnowFlow-local-2026!";
const people = [
  { name: "Marina Costa", email: "marina@example.test" },
  { name: "Rafael Lima", email: "rafael@example.test" },
  { name: "Ana Souza", email: "ana@example.test" },
];
const ids: string[] = [];
for (const person of people) {
  let [existing] = await rows<{ id: string }>(
    sql`SELECT id FROM "user" WHERE email=${person.email}`,
  );
  if (!existing) {
    const response = await getAuth().api.signUpEmail({
      body: { ...person, password },
    });
    existing = { id: response.user.id };
  }
  ids.push(existing.id);
}
const actor = { userId: ids[0] };
const [existing] = await rows<{ organization_id: string; team_id: string }>(
  sql`SELECT o.id AS organization_id,t.id AS team_id FROM organizations o JOIN teams t ON t.organization_id=o.id JOIN organization_members m ON m.organization_id=o.id WHERE o.name='Acme Studio · Demonstração' AND m.user_id=${actor.userId} AND t.name='Tecnologia'`,
);
await ensureBucket();
const base = existing
  ? { organizationId: existing.organization_id, teamId: existing.team_id }
  : await createOrganization(actor, "Acme Studio · Demonstração");
await getDb().execute(
  sql`UPDATE teams SET name='Tecnologia',description='Conhecimento e suporte da equipe de tecnologia' WHERE id=${base.teamId}`,
);
const [existingRh] = await rows<{ id: string }>(
  sql`SELECT id FROM teams WHERE organization_id=${base.organizationId} AND name='Pessoas & Cultura'`,
);
const rh = existingRh
  ? { organizationId: base.organizationId, teamId: existingRh.id }
  : await createTeam(
      actor,
      base.organizationId,
      "Pessoas & Cultura",
      "Orientação para as pessoas da organização",
    );
for (let i = 1; i < ids.length; i++) {
  await getDb().execute(
    sql`INSERT INTO organization_members VALUES (${base.organizationId},${ids[i]},'member') ON CONFLICT DO NOTHING`,
  );
  await getDb().execute(
    sql`INSERT INTO team_members VALUES (${base.organizationId},${base.teamId},${ids[i]},${i === 1 ? "manager" : "member"}) ON CONFLICT DO NOTHING`,
  );
}
for (const [scope, path, title] of [
  [base, "fixtures/guia-acesso-remoto.txt", "Guia de acesso remoto.txt"],
  [rh, "fixtures/guia-ferias.txt", "Guia de solicitação de férias.txt"],
] as const) {
  if (
    !(
      await rows(
        sql`SELECT id FROM documents WHERE team_id=${scope.teamId} AND title=${title} AND status<>'deleted'`,
      )
    ).length
  )
    await uploadDocument(
      actor,
      scope,
      new File([await readFile(path)], title, { type: "text/plain" }),
    );
}
await createRequest({ userId: ids[2] }, base, {
  confirmationId: "00000000-0000-4000-8000-000000000001",
  confirmed: true,
  title: "Exemplo: acesso à pasta compartilhada",
  summary:
    "Dados fictícios: não consigo acessar a pasta compartilhada após conferir minha conexão. Preciso de orientação da equipe.",
});
const [existingSecond] = await rows<{ id: string }>(
  sql`SELECT o.id FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE o.name='Outra organização · Demonstração' AND m.user_id=${ids[1]}`,
);
if (!existingSecond)
  await createOrganization(
    { userId: ids[1] },
    "Outra organização · Demonstração",
  );
console.log(
  "Dados fictícios criados. Contas locais: marina@example.test, rafael@example.test, ana@example.test.",
);
console.log(`Senha exclusiva de demonstração: ${password}`);
console.log(
  "Organizações de exemplo disponíveis. Execução repetida não duplica os exemplos.",
);
console.log(
  "Sem chave de IA, documentos enviados falharão com orientação de configuração. A rota /demo funciona sem serviços externos.",
);
process.exit(0);
