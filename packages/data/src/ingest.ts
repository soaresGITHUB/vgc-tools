import { Dex } from "@pkmn/dex";
import { Generations, toID } from "@pkmn/data";
import { applySchema, openDb, DB_PATH } from "./db.js";
import { existsSync, unlinkSync } from "node:fs";

interface Species {
  id: string;
  name: string;
  num: number;
  types: string[];
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  weightkg: number;
  abilities: Record<string, string>;
  baseSpecies: string;
  forme: string;
  isNonstandard: string | null;
  requiredItem?: string;
}

interface Move {
  id: string;
  name: string;
  type: string;
  category: string;
  basePower: number;
  accuracy: number | true;
  pp: number;
  priority: number;
  target: string;
  flags: Record<string, 1>;
  desc: string;
  shortDesc: string;
  isNonstandard: string | null;
}

interface Ability {
  id: string;
  name: string;
  desc: string;
  shortDesc: string;
  isNonstandard: string | null;
}

interface Item {
  id: string;
  name: string;
  desc: string;
  shortDesc: string;
  megaStone?: string;
  megaEvolves?: string;
  isNonstandard: string | null;
}

function isStandard<T extends { isNonstandard: string | null }>(d: T): boolean {
  return d.isNonstandard === null || d.isNonstandard === "Past";
}

async function main(): Promise<void> {
  if (existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
    console.log(`removed existing db at ${DB_PATH}`);
  }

  const db = openDb();
  applySchema(db);

  const gens = new Generations(Dex);
  const gen9 = gens.get(9);
  const gen7 = gens.get(7);

  const insertSpecies = db.prepare(`
    INSERT INTO species (id, name, num, hp, atk, def, spa, spd, spe, weight, is_mega, is_natdex, base_species, hidden_ability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSpeciesType = db.prepare(`
    INSERT INTO species_types (species_id, type, slot) VALUES (?, ?, ?)
  `);
  const insertSpeciesAbility = db.prepare(`
    INSERT OR IGNORE INTO species_abilities (species_id, ability, is_hidden) VALUES (?, ?, ?)
  `);
  const insertMove = db.prepare(`
    INSERT INTO moves (id, name, type, category, base_power, accuracy, pp, priority, target, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMoveFlag = db.prepare(`
    INSERT OR IGNORE INTO move_flags (move_id, flag) VALUES (?, ?)
  `);
  const insertAbility = db.prepare(`
    INSERT INTO abilities (id, name, description) VALUES (?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO items (id, name, description, is_mega_stone, mega_evolves) VALUES (?, ?, ?, ?, ?)
  `);
  const insertLearnset = db.prepare(`
    INSERT OR IGNORE INTO learnsets (species_id, move_id) VALUES (?, ?)
  `);
  const insertMeta = db.prepare(`
    INSERT INTO meta (key, value) VALUES (?, ?)
  `);

  const ingestSpecies = db.transaction((species: Species[]) => {
    for (const s of species) {
      const isMega = (s.forme ?? "").startsWith("Mega") ? 1 : 0;
      const baseSpecies = s.baseSpecies && s.baseSpecies !== s.name ? s.baseSpecies : null;
      const hiddenAbility = s.abilities["H"] ?? null;
      const isNatdex = natdexIds.has(s.id) ? 1 : 0;
      insertSpecies.run(
        s.id,
        s.name,
        s.num,
        s.baseStats.hp,
        s.baseStats.atk,
        s.baseStats.def,
        s.baseStats.spa,
        s.baseStats.spd,
        s.baseStats.spe,
        s.weightkg,
        isMega,
        isNatdex,
        baseSpecies,
        hiddenAbility,
      );
      s.types.forEach((t, i) => {
        insertSpeciesType.run(s.id, t, i);
      });
      for (const [slot, abilityName] of Object.entries(s.abilities)) {
        insertSpeciesAbility.run(s.id, abilityName, slot === "H" ? 1 : 0);
      }
    }
  });

  const ingestMoves = db.transaction((moves: Move[]) => {
    for (const m of moves) {
      const accuracy = m.accuracy === true ? 0 : m.accuracy;
      insertMove.run(
        m.id,
        m.name,
        m.type,
        m.category,
        m.basePower,
        accuracy,
        m.pp,
        m.priority,
        m.target,
        m.shortDesc || m.desc || "",
      );
      for (const flag of Object.keys(m.flags)) {
        insertMoveFlag.run(m.id, flag);
      }
    }
  });

  const ingestAbilities = db.transaction((abilities: Ability[]) => {
    for (const a of abilities) {
      insertAbility.run(a.id, a.name, a.shortDesc || a.desc || "");
    }
  });

  const ingestItems = db.transaction((items: Item[]) => {
    for (const i of items) {
      const isMegaStone = i.megaStone ? 1 : 0;
      insertItem.run(i.id, i.name, i.shortDesc || i.desc || "", isMegaStone, i.megaEvolves ?? null);
    }
  });

  const ingestLearnsets = db.transaction((entries: Array<[string, string]>) => {
    for (const [speciesId, moveId] of entries) {
      insertLearnset.run(speciesId, moveId);
    }
  });

  const speciesGen9 = Array.from(gen9.species).filter(isStandard) as unknown as Species[];
  const natdexIds = new Set<string>(speciesGen9.filter((s) => s.isNonstandard === null).map((s) => s.id));

  const megaSpecies = (Array.from(gen7.species) as unknown as Species[])
    .filter((s) => (s.forme ?? "").startsWith("Mega"))
    .filter(isStandard);

  const seenSpeciesIds = new Set<string>();
  const allSpecies: Species[] = [];
  for (const s of [...speciesGen9, ...megaSpecies]) {
    if (seenSpeciesIds.has(s.id)) continue;
    seenSpeciesIds.add(s.id);
    allSpecies.push(s);
  }

  console.log(`ingesting ${allSpecies.length} species (${speciesGen9.length} gen9 + ${megaSpecies.length} mega from gen7)`);
  ingestSpecies(allSpecies);

  const moves = (Array.from(gen9.moves) as unknown as Move[]).filter(isStandard);
  console.log(`ingesting ${moves.length} moves`);
  ingestMoves(moves);
  const ingestedMoveIds = new Set(moves.map((m) => m.id));

  const abilities = (Array.from(gen9.abilities) as unknown as Ability[]).filter(isStandard);
  console.log(`ingesting ${abilities.length} abilities`);
  ingestAbilities(abilities);

  const itemsGen9 = (Array.from(gen9.items) as unknown as Item[]).filter(isStandard);
  const megaStones = (Array.from(gen7.items) as unknown as Item[])
    .filter((i) => i.megaStone)
    .filter(isStandard);
  const seenItemIds = new Set<string>();
  const allItems: Item[] = [];
  for (const i of [...itemsGen9, ...megaStones]) {
    if (seenItemIds.has(i.id)) continue;
    seenItemIds.add(i.id);
    allItems.push(i);
  }
  console.log(`ingesting ${allItems.length} items (${itemsGen9.length} gen9 + ${megaStones.length} mega stones from gen7)`);
  ingestItems(allItems);

  console.log("ingesting learnsets...");
  const baseLearnsetCache = new Map<string, string[]>();
  const learnsetEntries: Array<[string, string]> = [];

  const nonMegaSpecies = allSpecies.filter((s) => !(s.forme ?? "").startsWith("Mega"));
  const megaForms = allSpecies.filter((s) => (s.forme ?? "").startsWith("Mega"));

  for (const s of nonMegaSpecies) {
    const ls = await gen9.learnsets.get(s.name);
    if (!ls?.learnset) continue;
    const moveIds = Object.keys(ls.learnset).map((m) => toID(m));
    baseLearnsetCache.set(s.id, moveIds);
    for (const moveId of moveIds) {
      if (ingestedMoveIds.has(moveId)) learnsetEntries.push([s.id, moveId]);
    }
  }

  let megaInheritedCount = 0;
  for (const m of megaForms) {
    const baseId = toID(m.baseSpecies);
    const baseMoves = baseLearnsetCache.get(baseId);
    if (!baseMoves) {
      console.warn(`mega ${m.id} has no base learnset (base=${baseId})`);
      continue;
    }
    megaInheritedCount++;
    for (const moveId of baseMoves) {
      if (ingestedMoveIds.has(moveId)) learnsetEntries.push([m.id, moveId]);
    }
  }

  console.log(`${baseLearnsetCache.size} base species + ${megaInheritedCount} megas inherited, ${learnsetEntries.length} entries`);
  ingestLearnsets(learnsetEntries);

  insertMeta.run("ingested_at", new Date().toISOString());
  insertMeta.run("source_generation", "9");
  insertMeta.run("mega_source_generation", "7");

  console.log(`done. db at ${DB_PATH}`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
