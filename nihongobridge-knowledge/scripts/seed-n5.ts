import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../schema/index.js";
import { seedN5 } from "../seeds/n5.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed N5 data");
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client, { schema });

try {
  await seedN5(db);
  console.info("N5 seed complete: 5 words, 5 kanji, 3 grammar patterns, 2 questions.");
} finally {
  await client.end();
}
