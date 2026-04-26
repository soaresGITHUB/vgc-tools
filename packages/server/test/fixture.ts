import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { Dex } from "@pkmn/dex";
import { Generations, toID } from "@pkmn/data";
import { isInPaldeaBaseDex } from "@pokequery/core";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { DbLike, PreparedStatement } from "../src/executor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createSqlJsAdapter(db: SqlJsDatabase): DbLike {
  return {
    prepare(sql: string): PreparedStatement {
      return {
        all(...params: unknown[]): unknown[] {
          const stmt = db.prepare(sql);
          stmt.bind(params as never[]);
          const rows: unknown[] = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
        get(...params: unknown[]): unknown {
          const stmt = db.prepare(sql);
          stmt.bind(params as never[]);
          const row = stmt.step() ? stmt.getAsObject() : undefined;
          stmt.free();
          return row;
        },
      };
    },
  };
}

let cachedDb: SqlJsDatabase | undefined;

export async function getTestDb(): Promise<DbLike> {
  if (cachedDb) return createSqlJsAdapter(cachedDb);

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const schemaPath = resolve(__dirname, "../../data/src/schema.sql");
  db.exec(readFileSync(schemaPath, "utf8"));

  const gens = new Generations(Dex);
  const gen9 = gens.get(9);
  const gen7 = gens.get(7);

  const isStandard = (d: { isNonstandard: string | null }): boolean =>
    d.isNonstandard === null || d.isNonstandard === "Past";

  const speciesGen9 = (Array.from(gen9.species) as any[]).filter(isStandard);

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
    "INSERT INTO species (id, name, num, hp, atk, def, spa, spd, spe, weight, is_mega, is_paldea_dex, base_species, hidden_ability) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  const insType = db.prepare("INSERT INTO species_types (species_id, type, slot) VALUES (?,?,?)");
  const insAbil = db.prepare(
    "INSERT OR IGNORE INTO species_abilities (species_id, ability, is_hidden) VALUES (?,?,?)",
  );
  db.exec("BEGIN");
  for (const s of allSpecies) {
    const baseSpecies = s.baseSpecies && s.baseSpecies !== s.name ? s.baseSpecies : null;
    insSpec.run([
      s.id, s.name, s.num,
      s.baseStats.hp, s.baseStats.atk, s.baseStats.def,
      s.baseStats.spa, s.baseStats.spd, s.baseStats.spe,
      s.weightkg, (s.forme ?? "").startsWith("Mega") ? 1 : 0,
      isInPaldeaBaseDex(s.id as string, s.num as number) ? 1 : 0,
      baseSpecies, s.abilities.H ?? null,
    ]);
    s.types.forEach((t: string, i: number) => insType.run([s.id, t, i]));
    for (const [slot, ab] of Object.entries(s.abilities) as [string, string][]) {
      insAbil.run([s.id, ab, slot === "H" ? 1 : 0]);
    }
  }
  db.exec("COMMIT");

  const insMove = db.prepare(
    "INSERT INTO moves (id, name, type, category, base_power, accuracy, pp, priority, target, description) VALUES (?,?,?,?,?,?,?,?,?,?)",
  );
  const moves = (Array.from(gen9.moves) as any[]).filter(isStandard);
  db.exec("BEGIN");
  for (const m of moves) {
    insMove.run([
      m.id, m.name, m.type, m.category, m.basePower,
      m.accuracy === true ? 0 : m.accuracy,
      m.pp, m.priority, m.target, m.shortDesc || m.desc || "",
    ]);
  }
  db.exec("COMMIT");

  const insAbilCat = db.prepare("INSERT INTO abilities (id, name, description) VALUES (?,?,?)");
  const abilities = (Array.from(gen9.abilities) as any[]).filter(isStandard);
  db.exec("BEGIN");
  for (const a of abilities) insAbilCat.run([a.id, a.name, a.shortDesc || a.desc || ""]);
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

  cachedDb = db;
  return createSqlJsAdapter(db);
}
