import { describe, it, expect, beforeAll } from "vitest";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { Dex } from "@pkmn/dex";
import { Generations, toID } from "@pkmn/data";
import { readFileSync } from "node:fs";
import {
  and,
  compilePredicate,
  hasType,
  immuneToType,
  isMega,
  learnsMove,
  not,
  or,
  partnerSpreadImmuneTo,
  statCompare,
  type Predicate,
} from "../src/predicates/index.js";

let db: SqlJsDatabase;

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  const schema = readFileSync(
    new URL("../../data/src/schema.sql", import.meta.url),
    "utf8",
  );
  db.exec(schema);

  const gens = new Generations(Dex);
  const gen9 = gens.get(9);
  const gen7 = gens.get(7);

  const isStandard = (d: { isNonstandard: string | null }): boolean =>
    d.isNonstandard === null || d.isNonstandard === "Past";

  const speciesGen9 = (Array.from(gen9.species) as any[]).filter(isStandard);
  const natdexIds = new Set<string>(speciesGen9.filter((s: any) => s.isNonstandard === null).map((s: any) => s.id as string));

  const megaSpecies = (Array.from(gen7.species) as any[])
    .filter((s) => (s.forme ?? "").startsWith("Mega"))
    .filter(isStandard);
  const seen = new Set<string>();
  const allSpecies: any[] = [];
  for (const s of [...speciesGen9, ...megaSpecies]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    allSpecies.push(s);
  }

  const insSpec = db.prepare(
    "INSERT INTO species (id, name, num, hp, atk, def, spa, spd, spe, weight, is_mega, is_natdex, base_species, hidden_ability) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  const insType = db.prepare("INSERT INTO species_types (species_id, type, slot) VALUES (?,?,?)");
  const insAbil = db.prepare("INSERT OR IGNORE INTO species_abilities (species_id, ability, is_hidden) VALUES (?,?,?)");
  db.exec("BEGIN");
  for (const s of allSpecies) {
    const baseSpecies = s.baseSpecies && s.baseSpecies !== s.name ? s.baseSpecies : null;
    insSpec.run([
      s.id, s.name, s.num,
      s.baseStats.hp, s.baseStats.atk, s.baseStats.def,
      s.baseStats.spa, s.baseStats.spd, s.baseStats.spe,
      s.weightkg, (s.forme ?? "").startsWith("Mega") ? 1 : 0,
      natdexIds.has(s.id) ? 1 : 0,
      baseSpecies, s.abilities.H ?? null,
    ]);
    s.types.forEach((t: string, i: number) => insType.run([s.id, t, i]));
    for (const [slot, ab] of Object.entries(s.abilities) as [string, string][]) {
      insAbil.run([s.id, ab, slot === "H" ? 1 : 0]);
    }
  }
  db.exec("COMMIT");

  const insLs = db.prepare("INSERT OR IGNORE INTO learnsets (species_id, move_id) VALUES (?,?)");
  const baseCache = new Map<string, string[]>();
  db.exec("BEGIN");
  for (const s of allSpecies.filter((x) => !(x.forme ?? "").startsWith("Mega"))) {
    const ls = await gen9.learnsets.get(s.name);
    if (!ls?.learnset) continue;
    const ids = Object.keys(ls.learnset).map((m) => toID(m));
    baseCache.set(s.id, ids);
    for (const mid of ids) insLs.run([s.id, mid]);
  }
  for (const m of allSpecies.filter((x) => (x.forme ?? "").startsWith("Mega"))) {
    const baseId = toID(m.baseSpecies);
    const moves = baseCache.get(baseId);
    if (!moves) continue;
    for (const mid of moves) insLs.run([m.id, mid]);
  }
  db.exec("COMMIT");
}, 60_000);

interface SpeciesRow { id: string; name: string }

function runQuery(predicate: Predicate): SpeciesRow[] {
  const { whereClause, params } = compilePredicate(predicate);
  const sql = `SELECT s.id, s.name FROM species s WHERE ${whereClause} ORDER BY s.id`;
  const stmt = db.prepare(sql);
  stmt.bind(params as any);
  const rows: SpeciesRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as SpeciesRow);
  }
  stmt.free();
  return rows;
}

describe("predicate -> SQL e2e", () => {
  it("should find Mudsdale by id", () => {
    const rows = runQuery({ kind: "speciesId", id: "mudsdale" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Mudsdale");
  });

  it("should find species that learn Trick Room and are immune to Ground", () => {
    const query = and(
      learnsMove("trickroom"),
      immuneToType("Ground"),
      not(isMega()),
    );
    const rows = runQuery(query);
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has("cresselia")).toBe(true);
    expect(ids.has("bronzong")).toBe(true);
    expect(ids.has("chimecho")).toBe(true);
  });

  it("should not return ground-type species when querying ground immunity", () => {
    const rows = runQuery(immuneToType("Ground"));
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has("mudsdale")).toBe(false);
    expect(ids.has("garchomp")).toBe(false);
  });

  it("should respect type-only ground immunity when allowAbilities is false", () => {
    const rows = runQuery(immuneToType("Ground", false));
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has("cresselia")).toBe(false);
    expect(ids.has("zapdos")).toBe(true);
  });

  it("should filter species by base speed", () => {
    const rows = runQuery(
      and(statCompare("spe", "lt", 50), learnsMove("trickroom")),
    );
    expect(rows.length).toBeGreaterThan(0);
    const counts = db.exec(
      "SELECT spe FROM species WHERE id IN ('" + rows.map((r) => r.id).join("','") + "')",
    )[0];
    for (const row of counts?.values ?? []) {
      expect(row[0]).toBeLessThan(50);
    }
  });

  it("should find ghost types via OR composition", () => {
    const rows = runQuery(or(hasType("Ghost"), hasType("Dragon")));
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has("dragapult")).toBe(true);
    expect(ids.has("gengar")).toBe(true);
  });

  it("should include Telepathy users in partnerSpreadImmuneTo even when not type-immune", () => {
    const rows = runQuery(partnerSpreadImmuneTo());
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has("oranguru")).toBe(true);
    expect(ids.has("cresselia")).toBe(true);
    expect(ids.has("zapdos")).toBe(true);
    expect(ids.has("mudsdale")).toBe(false);
  });

  it("should not include Telepathy users in plain immuneToType", () => {
    const rows = runQuery(immuneToType("Ground"));
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has("oranguru")).toBe(false);
  });

  it("should return Mega species only when isMega is required", () => {
    const rows = runQuery(isMega());
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.length).toBeLessThan(60);
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has("charizardmegay")).toBe(true);
    expect(ids.has("mudsdale")).toBe(false);
  });
});
