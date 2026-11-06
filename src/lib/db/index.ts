import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { type SQL } from "drizzle-orm";
import * as schema from "./schema";

const createDb = () => {
  if (!process.env.DATABASE_URL)
    throw new Error("Configure DATABASE_URL para usar a aplicação.");
  return drizzle(
    postgres(process.env.DATABASE_URL, {
      prepare: false,
      fetch_types: false,
    }),
    { schema },
  );
};
export type Database = ReturnType<typeof createDb>;
const globalDb = globalThis as unknown as { knowflowDb?: Database };
export function getDb(): Database {
  return (globalDb.knowflowDb ??= createDb());
}
export async function rows<T>(
  query: SQL,
  db: Pick<Database, "execute"> = getDb(),
): Promise<T[]> {
  const result = await db.execute(query);
  return (
    Array.isArray(result) ? result : (result as { rows: T[] }).rows
  ) as T[];
}
