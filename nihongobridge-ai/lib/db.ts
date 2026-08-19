import * as knowledgeSchema from "@nihongobridge/knowledge";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as aiSchema from "@/schema/ai";

const schema = { ...knowledgeSchema, ...aiSchema };

function createConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const configuredMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10);
  const client = postgres(databaseUrl, {
    max: Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => undefined,
  });
  return { client, db: drizzle(client, { schema }) };
}

type Connection = ReturnType<typeof createConnection>;
const globalDatabase = globalThis as typeof globalThis & {
  __nihongoBridgeAiDatabase?: Connection;
};

export function getDatabase(): Connection["db"] {
  globalDatabase.__nihongoBridgeAiDatabase ??= createConnection();
  return globalDatabase.__nihongoBridgeAiDatabase.db;
}

export async function closeDatabase(): Promise<void> {
  const connection = globalDatabase.__nihongoBridgeAiDatabase;
  if (!connection) return;
  await connection.client.end();
  delete globalDatabase.__nihongoBridgeAiDatabase;
}
