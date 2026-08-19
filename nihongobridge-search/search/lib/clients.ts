import { Meilisearch } from "meilisearch";
import postgres, { type Sql } from "postgres";

import { config } from "./config.js";

let meili: Meilisearch | undefined;
let database: Sql | undefined;

export function meilisearch(): Meilisearch {
  const values = config();
  meili ??= new Meilisearch({
    host: values.MEILISEARCH_URL,
    apiKey: values.MEILI_MASTER_KEY,
    timeout: 10_000,
  });
  return meili;
}

export function db(): Sql {
  const values = config();
  database ??= postgres(values.DATABASE_URL, {
    max: 4,
    idle_timeout: 30,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => undefined,
  });
  return database;
}

export async function closeClients(): Promise<void> {
  if (database) await database.end();
  database = undefined;
  meili = undefined;
}
