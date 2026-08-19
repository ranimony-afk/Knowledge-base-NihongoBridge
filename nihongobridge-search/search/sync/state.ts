import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { config } from "../lib/config.js";

export interface SyncState {
  version: 1;
  updatedAt: Record<"dictionary" | "kanji" | "grammar" | "sentences", string>;
  lastSuccessfulRun: string | null;
}

const initialState: SyncState = {
  version: 1,
  updatedAt: {
    dictionary: "1970-01-01T00:00:00.000Z",
    kanji: "1970-01-01T00:00:00.000Z",
    grammar: "1970-01-01T00:00:00.000Z",
    sentences: "1970-01-01T00:00:00.000Z",
  },
  lastSuccessfulRun: null,
};

export async function loadState(): Promise<SyncState> {
  try {
    const parsed = JSON.parse(await readFile(config().SEARCH_STATE_PATH, "utf8")) as SyncState;
    return parsed.version === 1 ? parsed : structuredClone(initialState);
  } catch {
    return structuredClone(initialState);
  }
}

export async function saveState(state: SyncState): Promise<void> {
  const path = config().SEARCH_STATE_PATH;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export async function acquireSyncLock(): Promise<() => Promise<void>> {
  const path = config().SEARCH_LOCK_PATH;
  await mkdir(dirname(path), { recursive: true });
  try {
    const info = await stat(path);
    if (Date.now() - info.mtimeMs > 60 * 60 * 1_000) await unlink(path);
  } catch {
    // The lock does not exist.
  }
  let handle;
  try {
    handle = await open(path, "wx");
  } catch (error) {
    if (error && typeof error === "object" && Reflect.get(error, "code") === "EEXIST") {
      throw new Error(`Another sync process owns ${path}`);
    }
    throw error;
  }
  await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`);
  return async () => {
    await handle.close();
    await unlink(path).catch(() => undefined);
  };
}
