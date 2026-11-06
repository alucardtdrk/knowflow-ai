import { betterAuth } from "better-auth";
import { randomUUID } from "node:crypto";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db";
import * as schema from "./db/schema";

function createAuth() {
  if (
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32
  )
    throw new Error(
      "Configure BETTER_AUTH_SECRET com pelo menos 32 caracteres.",
    );
  return betterAuth({
    logger: { disabled: true },
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    advanced: { database: { generateId: () => randomUUID() } },
    rateLimit: { enabled: true, window: 60, max: 30 },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
