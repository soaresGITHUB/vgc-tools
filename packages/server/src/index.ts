import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerQueryRoute } from "./routes/query.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import type { DbLike } from "./executor.js";

export interface BuildAppOptions {
  db?: DbLike;
  dbPath?: string;
  logger?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<{ app: FastifyInstance; close: () => void }> {
  const app = Fastify({ logger: opts.logger ?? { level: process.env.LOG_LEVEL ?? "info" } });
  let ownsDb = false;
  let db: DbLike;
  if (opts.db) {
    db = opts.db;
  } else {
    const { openDb } = await import("@pokequery/data");
    const real = openDb(opts.dbPath);
    db = real as unknown as DbLike;
    ownsDb = true;
    app.addHook("onClose", async () => real.close());
  }

  app.register(cors, { origin: true });
  app.get("/health", async () => ({ ok: true }));
  registerQueryRoute(app, db);
  registerCatalogRoutes(app, db);

  return {
    app,
    close: () => {
      if (ownsDb && "close" in db && typeof (db as { close?: () => void }).close === "function") {
        (db as { close: () => void }).close();
      }
    },
  };
}

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const isMain = resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "");
if (isMain) {
  const port = Number(process.env.PORT ?? 3001);
  buildApp()
    .then(({ app, close }) => {
      app.listen({ port, host: "0.0.0.0" })
        .then(() => app.log.info(`pokequery server on :${port}`))
        .catch((err) => {
          app.log.error(err);
          close();
          process.exit(1);
        });
      process.on("SIGINT", () => {
        close();
        process.exit(0);
      });
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
