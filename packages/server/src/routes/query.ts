import type { FastifyInstance } from "fastify";
import { querySchema } from "../schema.js";
import { executeQuery, type DbLike } from "../executor.js";

export function registerQueryRoute(app: FastifyInstance, db: DbLike): void {
  app.post("/query", async (request, reply) => {
    const parsed = querySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid query", details: parsed.error.format() });
    }

    try {
      const outcome = executeQuery(db, parsed.data);
      return outcome;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      request.log.error({ err }, "query execution failed");
      return reply.code(400).send({ error: msg });
    }
  });
}
