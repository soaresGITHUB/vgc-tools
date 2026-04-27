import { Dex } from "@pkmn/dex";
import { Generations, toID } from "@pkmn/data";
import { applySchema, openDb, DB_PATH } from "./db.js";
import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGAL_SPECIES_DIR = join(__dirname, "legal-species");

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

function parseAllowlist(path: string): string[] {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const ids: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    ids.push(line);
  }
  return ids;
}

const FILENAME_TO_FORMAT_ID: Record<string, string> = {
  "reg-m-a": "vgc-2026-reg-m-a",
  "reg-i": "vgc-2026-reg-i",
};

function formatIdFromFilename(stem: string): string {
  const id = FILENAME_TO_FORMAT_ID[stem];
  if (!id) throw new Error(`legal-species: no format mapping for filename "${stem}.txt"`);
  return id;
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
  const gen8 = gens.get(8);
  const gen7 = gens.get(7);

  const insertSpecies = db.prepare(`
    INSERT INTO species (id, name, num, hp, atk, def, spa, spd, spe, weight, is_mega, base_species, hidden_ability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFormatLegality = db.prepare(`
    INSERT OR IGNORE INTO species_format_legality (species_id, format_id) VALUES (?, ?)
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

  const allowlistFiles: Array<{ formatId: string; ids: string[]; file: string }> = [];
  for (const file of readdirSync(LEGAL_SPECIES_DIR)) {
    if (!file.endsWith(".txt")) continue;
    const formatId = formatIdFromFilename(basename(file, ".txt"));
    const ids = parseAllowlist(join(LEGAL_SPECIES_DIR, file));
    allowlistFiles.push({ formatId, ids, file });
  }
  const allLegalIds = new Set(allowlistFiles.flatMap((f) => f.ids));

  const speciesGen9 = Array.from(gen9.species).filter(isStandard) as unknown as Species[];

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

  const homeSupplementIds = [...allLegalIds].filter((id) => !seenSpeciesIds.has(id));
  const homeFromGen8: Species[] = [];
  const homeFromGen7: Species[] = [];
  const homeUnresolved: string[] = [];
  for (const id of homeSupplementIds) {
    const fromGen8 = gen8.species.get(id) as unknown as Species | undefined;
    if (fromGen8) {
      homeFromGen8.push(fromGen8);
      seenSpeciesIds.add(fromGen8.id);
      allSpecies.push(fromGen8);
      continue;
    }
    const fromGen7 = gen7.species.get(id) as unknown as Species | undefined;
    if (fromGen7) {
      homeFromGen7.push(fromGen7);
      seenSpeciesIds.add(fromGen7.id);
      allSpecies.push(fromGen7);
      continue;
    }
    homeUnresolved.push(id);
  }
  if (homeFromGen8.length + homeFromGen7.length > 0) {
    console.log(`HOME supplement: +${homeFromGen8.length} from gen8, +${homeFromGen7.length} from gen7 (${homeFromGen8.map((s) => s.id).concat(homeFromGen7.map((s) => s.id)).join(", ")})`);
  }
  if (homeUnresolved.length > 0) {
    console.warn(`HOME supplement: could not resolve ${homeUnresolved.length} ids in gen8/gen7: ${homeUnresolved.join(", ")}`);
  }

  console.log(`ingesting ${allSpecies.length} species (${speciesGen9.length} gen9 + ${megaSpecies.length} mega from gen7 + ${homeFromGen8.length + homeFromGen7.length} HOME supplement)`);
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

  const learnsetSources = [gen9, gen8, gen7];
  for (const s of nonMegaSpecies) {
    let moveIds: string[] | null = null;
    for (const g of learnsetSources) {
      const ls = await g.learnsets.get(s.name);
      if (ls?.learnset) {
        moveIds = Object.keys(ls.learnset).map((m) => toID(m));
        break;
      }
    }
    if (!moveIds) continue;
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

  const knownSpeciesIds = new Set(allSpecies.map((s) => s.id));
  const ingestFormatLegality = db.transaction((entries: Array<[string, string]>) => {
    for (const [speciesId, formatId] of entries) {
      insertFormatLegality.run(speciesId, formatId);
    }
  });
  for (const { formatId, ids, file } of allowlistFiles) {
    const known: Array<[string, string]> = [];
    const unknown: string[] = [];
    for (const id of ids) {
      if (knownSpeciesIds.has(id)) known.push([id, formatId]);
      else unknown.push(id);
    }
    ingestFormatLegality(known);
    console.log(`legality: ${formatId} ← ${known.length} entries from ${file}` + (unknown.length > 0 ? ` (${unknown.length} unknown skipped: ${unknown.join(", ")})` : ""));
  }

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
