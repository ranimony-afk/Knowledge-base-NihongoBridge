import { pathToFileURL } from "node:url";

import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";

import { closeClients, meilisearch } from "../lib/clients.js";
import { config } from "../lib/config.js";
import { multiIndexSearch } from "../lib/query.js";
import { autocomplete } from "./autocomplete.js";

export async function createServer() {
  const values = config();
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: ["req.headers.authorization"],
    },
    trustProxy: true,
    requestTimeout: 5_000,
  });
  const allowedOrigins = values.AUTOCOMPLETE_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin is not allowed"), false);
      }
    },
    methods: ["GET"],
  });

  app.get("/health", async (_request, reply) => {
    const health = await meilisearch().health();
    return reply.code(health.status === "available" ? 200 : 503).send({
      status: health.status === "available" ? "ok" : "degraded",
      meilisearch: health.status,
    });
  });

  app.get("/autocomplete", async (request, reply) => {
    const started = performance.now();
    const result = await autocomplete(request.query);
    const elapsed = performance.now() - started;
    reply.header(
      "Server-Timing",
      `meili;dur=${result.processingTimeMs.toFixed(2)}, total;dur=${elapsed.toFixed(2)}`,
    );
    reply.header("X-Cache", result.cache);
    return reply.send({
      data: result.data,
      meta: {
        total: result.data.length,
        processing_time_ms: result.processingTimeMs,
        target_ms: 50,
        within_target: elapsed < 50,
      },
    });
  });

  app.get("/search", async (request, reply) => {
    const parameters = new URLSearchParams(
      Object.entries(request.query as Record<string, string>).map(([key, value]) => [
        key,
        String(value),
      ]),
    );
    const result = await multiIndexSearch(parameters);
    reply.header("Server-Timing", `total;dur=${result.processingTimeMs.toFixed(2)}`);
    return reply.send(result);
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Invalid request",
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "Search service error" });
  });

  app.addHook("onClose", async () => closeClients());
  return app;
}

async function main(): Promise<void> {
  const values = config();
  const app = await createServer();
  await app.listen({ host: values.AUTOCOMPLETE_HOST, port: values.AUTOCOMPLETE_PORT });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
