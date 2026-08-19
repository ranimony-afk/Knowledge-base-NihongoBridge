import * as schema from "@nihongobridge/knowledge";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

function createConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const max = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10);
  const client = postgres(databaseUrl, {
    max: Number.isFinite(max) && max > 0 ? max : 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => undefined,
  });
  return {
    client,
    db: drizzle(client, { schema }),
  };
}

type Connection = ReturnType<typeof createConnection>;
export type AppDatabase = Connection["db"];

const globalDatabase = globalThis as typeof globalThis & {
  __nihongoBridgeDatabase?: Connection;
};

export function getDatabase(): Connection["db"] {
  if (!globalDatabase.__nihongoBridgeDatabase) {
    globalDatabase.__nihongoBridgeDatabase = createConnection();
  }
  return globalDatabase.__nihongoBridgeDatabase.db;
}

export async function closeDatabase(): Promise<void> {
  const connection = globalDatabase.__nihongoBridgeDatabase;
  if (connection) {
    await connection.client.end();
    delete globalDatabase.__nihongoBridgeDatabase;
  }
}
