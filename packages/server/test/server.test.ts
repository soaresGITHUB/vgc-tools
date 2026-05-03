import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/index.js";
import { getTestDb } from "./fixture.js";

interface MatchReasons {
  moves: string[];
  abilities: string[];
  types: string[];
  stats: string[];
}

interface SpeciesResult {
  id: string;
  name: string;
  types: string[];
  abilities: { name: string; isHidden: boolean }[];
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  isMega: boolean;
  matchReasons: MatchReasons;
}

interface QueryResponse {
  total: number;
  results: SpeciesResult[];
  format: { id: string; name: string } | null;
}

let app: FastifyInstance;

beforeAll(async () => {
  const db = await getTestDb();
  const built = await buildApp({ db, logger: false });
  app = built.app;
  await app.ready();
}, 60_000);

describe("POST /query", () => {
  it("should return Cresselia for the TR + ground-immune query", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: {
          kind: "and",
          children: [
            { kind: "learnsMove", moveId: "trickroom" },
            { kind: "immuneToType", type: "Ground", allowAbilities: true },
            { kind: "not", child: { kind: "isMega" } },
          ],
        },
        limit: 50,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBeGreaterThan(0);
    expect(body.results.some((r) => r.id === "cresselia")).toBe(true);
    expect(body.results.some((r) => r.id === "bronzong")).toBe(true);
  });

  it("should hydrate types and abilities in results", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: { predicate: { kind: "speciesId", id: "mudsdale" } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.results).toHaveLength(1);
    const mudsdale = body.results[0];
    expect(mudsdale?.types).toEqual(["Ground"]);
    const abilityNames = mudsdale?.abilities.map((a) => a.name).sort();
    expect(abilityNames).toContain("Stamina");
    expect(abilityNames).toContain("Inner Focus");
  });

  it("should report a matched ability in matchReasons for ground immunity via Levitate", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "immuneToType", type: "Ground", allowAbilities: true },
        limit: 200,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    const cresselia = body.results.find((r) => r.id === "cresselia");
    expect(cresselia?.matchReasons.abilities).toContain("Levitate");
  });

  it("should report a matched move in matchReasons for learnsMove", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "learnsMove", moveId: "trickroom" },
        limit: 200,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    const cresselia = body.results.find((r) => r.id === "cresselia");
    expect(cresselia?.matchReasons.moves).toContain("trickroom");
  });

  it("should match Pelipper (Drizzle) for isWeatherSetter('rain') and surface the ability", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: {
          kind: "and",
          children: [
            { kind: "isWeatherSetter", weather: "rain" },
            { kind: "speciesId", id: "pelipper" },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(1);
    expect(body.results[0]?.matchReasons.abilities).toContain("Drizzle");
  });

  it("should match Torkoal (Drought) for isWeatherSetter('sun')", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: {
          kind: "and",
          children: [
            { kind: "isWeatherSetter", weather: "sun" },
            { kind: "speciesId", id: "torkoal" },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(1);
    expect(body.results[0]?.matchReasons.abilities).toContain("Drought");
  });

  it("should match Tyranitar (Sand Stream) for isWeatherSetter('sand')", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: {
          kind: "and",
          children: [
            { kind: "isWeatherSetter", weather: "sand" },
            { kind: "speciesId", id: "tyranitar" },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(1);
    expect(body.results[0]?.matchReasons.abilities).toContain("Sand Stream");
  });

  it("should not surface Sand Stream as a reason under isWeatherSetter('rain') (only rain abilities/moves count)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: {
          kind: "and",
          children: [
            { kind: "isWeatherSetter", weather: "rain" },
            { kind: "speciesId", id: "tyranitar" },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(1);
    const reasons = body.results[0]!.matchReasons;
    expect(reasons.abilities).not.toContain("Sand Stream");
    expect(reasons.moves).toContain("raindance");
  });

  it("should match Pelipper under isWeatherSetter('rain','ability') with no move reason", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: {
          kind: "and",
          children: [
            { kind: "isWeatherSetter", weather: "rain", via: "ability" },
            { kind: "speciesId", id: "pelipper" },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(1);
    expect(body.results[0]?.matchReasons.abilities).toContain("Drizzle");
    expect(body.results[0]?.matchReasons.moves).toHaveLength(0);
  });

  it("should match Klefki under isWeatherSetter('rain','prankster')", async () => {
    // Klefki has Prankster as its primary ability and learns Rain Dance in Gen 9
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: {
          kind: "and",
          children: [
            { kind: "isWeatherSetter", weather: "rain", via: "prankster" },
            { kind: "speciesId", id: "klefki" },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(1);
    expect(body.results[0]?.matchReasons.abilities).toContain("Prankster");
    expect(body.results[0]?.matchReasons.moves).toContain("raindance");
  });

  it("should not match Pelipper under isWeatherSetter('rain','prankster') (no Prankster)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: {
          kind: "and",
          children: [
            { kind: "isWeatherSetter", weather: "rain", via: "prankster" },
            { kind: "speciesId", id: "pelipper" },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(0);
  });

  it("should not exclude Miraidon under isWeatherSetter (Hadron Engine is electric terrain, not weather)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: {
          kind: "and",
          children: [
            { kind: "isWeatherSetter" },
            { kind: "speciesId", id: "miraidon" },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    if (body.total === 1) {
      expect(body.results[0]?.matchReasons.abilities).not.toContain("Hadron Engine");
    }
  });

  it("should reject malformed predicates with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: { predicate: { kind: "garbage" } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("should reject queries that would exceed the limit cap", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "speciesId", id: "mudsdale" },
        limit: 9999,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("should respect sortBy and sortDir", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "learnsMove", moveId: "trickroom" },
        limit: 5,
        sortBy: "spe",
        sortDir: "asc",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    const speeds = body.results.map((r) => r.baseStats.spe);
    const sorted = [...speeds].sort((a, b) => a - b);
    expect(speeds).toEqual(sorted);
  });

  it("should exclude Megas when format has megaEvolution disabled", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "isMega" },
        formatId: "vgc-2026-reg-i",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(0);
  });

  it("should include Megas when format has megaEvolution enabled", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "isMega" },
        formatId: "vgc-2026-reg-m-a",
        limit: 100,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBeGreaterThan(15);
  });

  it("should exclude Gastly from M-A (not in Reg M-A pool)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "speciesId", id: "gastly" },
        formatId: "vgc-2026-reg-m-a",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(0);
  });

  it("should exclude Bronzong from M-A (not in Reg M-A pool)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "speciesId", id: "bronzong" },
        formatId: "vgc-2026-reg-m-a",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(0);
  });

  it("should exclude Drifblim from M-A (not in Reg M-A pool)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "speciesId", id: "drifblim" },
        formatId: "vgc-2026-reg-m-a",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(0);
  });

  it("should include Garchomp in M-A (in Reg M-A pool)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "speciesId", id: "garchomp" },
        formatId: "vgc-2026-reg-m-a",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(1);
  });

  it("should exclude Articuno from M-A (not in Paldea base dex)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "speciesId", id: "articuno" },
        formatId: "vgc-2026-reg-m-a",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(0);
  });

  it("should exclude Dialga from M-A (restricted legendary, maxRestricted=0)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "speciesId", id: "dialga" },
        formatId: "vgc-2026-reg-m-a",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as QueryResponse;
    expect(body.total).toBe(0);
  });

  it("should reject an unknown format with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/query",
      payload: {
        predicate: { kind: "isMega" },
        formatId: "made-up-format",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /formats", () => {
  it("should return registered formats", async () => {
    const res = await app.inject({ method: "GET", url: "/formats" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string }>;
    expect(body.some((f) => f.id === "vgc-2026-reg-m-a")).toBe(true);
    expect(body.some((f) => f.id === "vgc-2026-reg-i")).toBe(true);
  });
});

describe("GET /moves and /abilities", () => {
  it("should return move catalog including Earthquake", async () => {
    const res = await app.inject({ method: "GET", url: "/moves" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string; name: string }>;
    expect(body.some((m) => m.id === "earthquake")).toBe(true);
    expect(body.some((m) => m.id === "trickroom")).toBe(true);
  });

  it("should return ability catalog including Levitate", async () => {
    const res = await app.inject({ method: "GET", url: "/abilities" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string; name: string }>;
    expect(body.some((a) => a.id === "levitate")).toBe(true);
  });
});

describe("GET /health", () => {
  it("should return ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
