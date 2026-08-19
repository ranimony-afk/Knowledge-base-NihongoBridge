import * as knowledge from "@nihongobridge/knowledge";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as admin from "@/schema/admin";

const schema = { ...knowledge, ...admin };

function createConnection() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
  return { client, db: drizzle(client, { schema }) };
}

type Connection = ReturnType<typeof createConnection>;
const globalDb = globalThis as typeof globalThis & { __nihongoAdminDb?: Connection };

export function getAdminDb(): Connection["db"] {
  globalDb.__nihongoAdminDb ??= createConnection();
  return globalDb.__nihongoAdminDb.db;
}

export async function closeAdminDb(): Promise<void> {
  if (globalDb.__nihongoAdminDb) {
    await globalDb.__nihongoAdminDb.client.end();
    delete globalDb.__nihongoAdminDb;
  }
}
