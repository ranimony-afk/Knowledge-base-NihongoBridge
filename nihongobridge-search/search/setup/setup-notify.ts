import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { closeClients, db } from "../lib/clients.js";
import { config } from "../lib/config.js";

export async function setupNotifyTriggers(): Promise<void> {
  const templatePath = fileURLToPath(new URL("../sql/notify-triggers.sql", import.meta.url));
  const template = await readFile(templatePath, "utf8");
  const channel = config().SEARCH_NOTIFY_CHANNEL;
  const source = template.replaceAll("__CHANNEL__", channel);
  await db().unsafe(source);
  console.info(`Installed content-change triggers for channel: ${channel}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  setupNotifyTriggers()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(closeClients);
}
