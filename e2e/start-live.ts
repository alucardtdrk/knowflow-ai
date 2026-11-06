// Disposable test services only. Never imported by the application.
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { drizzle } from "drizzle-orm/pglite";
import type { Database } from "../src/lib/db";
import { processNextJob } from "../src/features/documents/worker";
const pg = new PGlite({ extensions: { vector } });
(globalThis as unknown as { knowflowDb: Database }).knowflowDb = drizzle(
  pg,
) as unknown as Database;
await pg.exec(await readFile("drizzle/0000_initial.sql", "utf8"));
const socket = new PGLiteSocketServer({
  db: pg,
  host: "127.0.0.1",
  port: 5544,
  maxConnections: 20,
});
await socket.start();
const files = new Map<string, Buffer>();
const calls: string[] = [];
const fake = createServer(async (req, res) => {
  calls.push(`${req.method} ${req.url}`);
  const parts: Buffer[] = [];
  for await (const chunk of req) parts.push(Buffer.from(chunk));
  const body = Buffer.concat(parts);
  const url = req.url || "/";
  if (url === "/process" && req.method === "POST") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ processed: await processNextJob() }));
    return;
  }
  if (url === "/diagnostics") {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        calls,
        documents: (await pg.query("select id,status,error from documents"))
          .rows,
        jobs: (await pg.query("select status,attempts,kind from jobs")).rows,
      }),
    );
    return;
  }
  if (url.startsWith("/v1/embeddings")) {
    const input = JSON.parse(body.toString()).input as string[];
    const encoded = JSON.parse(body.toString()).encoding_format === "base64";
    const embedding = encoded
      ? Buffer.from(
          new Float32Array([1, ...Array(1535).fill(0)]).buffer,
        ).toString("base64")
      : [1, ...Array(1535).fill(0)];
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        object: "list",
        data: input.map((_, index) => ({
          object: "embedding",
          index,
          embedding,
        })),
        model: "fixture",
        usage: { prompt_tokens: 1, total_tokens: 1 },
      }),
    );
    return;
  }
  if (url.startsWith("/v1/chat/completions")) {
    const input = JSON.parse(body.toString());
    const data = JSON.parse(input.messages[1].content);
    const source = data.documents[0];
    const value = {
      text: source
        ? "O guia orienta verificar a conexão com a internet antes de tentar acessar a VPN."
        : "Não há evidência suficiente.",
      sourceIds: source ? [source.chunkId] : [],
      nextStep: data.history.some((m: { content: string }) =>
        m.content.includes("não resolveu"),
      )
        ? null
        : "Verifique a conexão com a internet",
    };
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: "fixture",
        object: "chat.completion",
        created: 1,
        model: "fixture",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: JSON.stringify(value) },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
    return;
  }
  const key = url.split("?")[0];
  if (req.method === "PUT") {
    files.set(key, body);
    res.statusCode = 200;
    res.end();
    return;
  }
  if (req.method === "DELETE") {
    files.delete(key);
    res.end();
    return;
  }
  if (req.method === "HEAD") {
    res.statusCode = files.has(key) ? 200 : 404;
    res.end();
    return;
  }
  if (req.method === "GET" && files.has(key)) {
    res.setHeader("Content-Length", String(files.get(key)!.length));
    res.end(files.get(key));
    return;
  }
  if (url === "/health") {
    res.end("ready");
    return;
  }
  res.statusCode = 404;
  res.end();
});
await new Promise<void>((resolve) => fake.listen(5545, "127.0.0.1", resolve));
const env = {
  ...process.env,
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5544/postgres?max=1",
  BETTER_AUTH_SECRET: "e2e-disposable-secret-00000000000000000000000",
  BETTER_AUTH_URL: "http://localhost:3100",
  S3_ENDPOINT: "http://127.0.0.1:5545",
  S3_REGION: "us-east-1",
  S3_BUCKET: "test",
  S3_ACCESS_KEY_ID: "test",
  S3_SECRET_ACCESS_KEY: "test",
  OPENAI_API_KEY: "fixture-not-a-real-key",
  OPENAI_BASE_URL: "http://127.0.0.1:5545/v1",
  NEXT_TELEMETRY_DISABLED: "1",
};
Object.assign(process.env, env);
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    "3100",
    "--hostname",
    "127.0.0.1",
  ],
  { env, stdio: "inherit" },
);
async function stop() {
  app.kill();
  fake.close();
  await socket.stop();
  await pg.close();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
console.log("Disposable test services ready.");
