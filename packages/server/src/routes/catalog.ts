import type { FastifyInstance } from "fastify";
import { FORMATS } from "@pokequery/core";
import type { DbLike } from "../executor.js";

interface MoveRow {
  id: string;
  name: string;
  type: string;
  category: string;
  base_power: number;
  accuracy: number;
  priority: number;
  target: string;
}

interface AbilityRow {
  id: string;
  name: string;
  description: string;
}

export function registerCatalogRoutes(app: FastifyInstance, db: DbLike): void {
  app.get("/formats", async () => {
    return Object.values(FORMATS).map((f) => ({
      id: f.id,
      name: f.name,
      generation: f.generation,
      mechanics: f.mechanics,
    }));
  });

  app.get("/moves", async () => {
    return db
      .prepare(
        "SELECT id, name, type, category, base_power, accuracy, priority, target FROM moves ORDER BY name",
      )
      .all() as MoveRow[];
  });

  app.get("/abilities", async () => {
    return db.prepare("SELECT id, name, description FROM abilities ORDER BY name").all() as AbilityRow[];
  });
}
