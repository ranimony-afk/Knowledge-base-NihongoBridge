import { pathToFileURL } from "node:url";

import { meilisearch } from "../lib/clients.js";
import { INDEXES } from "../lib/config.js";
import { INDEX_SETTINGS } from "./settings.js";

export async function configureIndexes(): Promise<void> {
  const client = meilisearch();
  const health = await client.health();
  if (health.status !== "available") throw new Error("Meilisearch is not available");

  for (const indexName of Object.values(INDEXES)) {
    const index = client.index(indexName);
    try {
      await index.getRawInfo();
    } catch {
      const task = await client.createIndex(indexName, { primaryKey: "id" });
      await waitForTask(task.taskUid, `create ${indexName}`);
    }
    const settingsTask = await index.updateSettings(INDEX_SETTINGS[indexName]!);
    await waitForTask(settingsTask.taskUid, `configure ${indexName}`);
    console.info(`Configured index: ${indexName}`);
  }
}

async function waitForTask(taskUid: number, operation: string): Promise<void> {
  const task = await meilisearch().tasks.waitForTask(taskUid, {
    timeout: 120_000,
    interval: 100,
  });
  if (task.status === "failed") {
    throw new Error(`${operation} failed: ${task.error?.message ?? "unknown task error"}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  configureIndexes().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
