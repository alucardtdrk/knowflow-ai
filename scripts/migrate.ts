import { readFile } from "node:fs/promises";
import postgres from "postgres";
if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL.");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(725104)`;
    await tx`CREATE TABLE IF NOT EXISTS knowflow_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    for (const name of ["0000_initial", "0001_chat_step_responses"]) {
      if (
        !(await tx`SELECT name FROM knowflow_migrations WHERE name = ${name}`)
          .length
      ) {
        await tx.unsafe(await readFile(`drizzle/${name}.sql`, "utf8"));
        await tx`INSERT INTO knowflow_migrations(name) VALUES (${name})`;
      }
    }
  });
  console.log("Migrações aplicadas.");
} finally {
  await sql.end();
}
