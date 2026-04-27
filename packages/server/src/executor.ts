import {
  collectMatchTargets,
  compilePredicate,
  computeMatchReasons,
  FORMATS,
  type Format,
  type MatchReasons,
  type PokemonType,
  type Predicate,
} from "@pokequery/core";

export interface PreparedStatement {
  all: (...params: unknown[]) => unknown[];
  get?: (...params: unknown[]) => unknown;
}

export interface DbLike {
  prepare: (sql: string) => PreparedStatement;
}

export interface SpeciesResult {
  id: string;
  name: string;
  types: string[];
  abilities: { name: string; isHidden: boolean }[];
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  isMega: boolean;
  baseSpecies: string | null;
  matchReasons: MatchReasons;
}

export interface QueryOptions {
  predicate: Predicate;
  formatId?: string;
  limit: number;
  sortBy: "name" | "spe" | "hp" | "atk" | "def" | "spa" | "spd";
  sortDir: "asc" | "desc";
}

export interface QueryOutcome {
  total: number;
  results: SpeciesResult[];
  format: { id: string; name: string } | null;
}

const SORT_COLUMNS: Record<QueryOptions["sortBy"], string> = {
  name: "s.name",
  spe: "s.spe",
  hp: "s.hp",
  atk: "s.atk",
  def: "s.def",
  spa: "s.spa",
  spd: "s.spd",
};

interface SpeciesRow {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  is_mega: number;
  base_species: string | null;
}

interface TypeRow { species_id: string; type: string; slot: number }
interface AbilityRow { species_id: string; ability: string; is_hidden: number }
interface LearnsetRow { species_id: string; move_id: string }

export function executeQuery(db: DbLike, opts: QueryOptions): QueryOutcome {
  const format = opts.formatId ? FORMATS[opts.formatId] ?? null : null;
  if (opts.formatId && !format) {
    throw new Error(`unknown format: ${opts.formatId}`);
  }

  const { whereClause, params } = compilePredicate(opts.predicate);
  const formatClauses = format ? buildFormatClauses(format, params) : "";
  const fullWhere = formatClauses ? `(${whereClause}) AND ${formatClauses}` : whereClause;

  const orderBy = `ORDER BY ${SORT_COLUMNS[opts.sortBy]} ${opts.sortDir.toUpperCase()}`;
  const sql = `
    SELECT s.id, s.name, s.hp, s.atk, s.def, s.spa, s.spd, s.spe, s.is_mega, s.base_species
    FROM species s
    WHERE ${fullWhere}
    ${orderBy}
    LIMIT ?
  `;

  const rows = db.prepare(sql).all(...params, opts.limit) as SpeciesRow[];
  if (rows.length === 0) {
    return {
      total: 0,
      results: [],
      format: format ? { id: format.id, name: format.name } : null,
    };
  }

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const typeRows = db
    .prepare(`SELECT species_id, type, slot FROM species_types WHERE species_id IN (${placeholders}) ORDER BY species_id, slot`)
    .all(...ids) as TypeRow[];
  const abilityRows = db
    .prepare(`SELECT species_id, ability, is_hidden FROM species_abilities WHERE species_id IN (${placeholders})`)
    .all(...ids) as AbilityRow[];

  const typesByid = new Map<string, PokemonType[]>();
  for (const t of typeRows) {
    const arr = typesByid.get(t.species_id) ?? [];
    arr.push(t.type as PokemonType);
    typesByid.set(t.species_id, arr);
  }
  const abilitiesById = new Map<string, { name: string; isHidden: boolean }[]>();
  for (const a of abilityRows) {
    const arr = abilitiesById.get(a.species_id) ?? [];
    arr.push({ name: a.ability, isHidden: a.is_hidden === 1 });
    abilitiesById.set(a.species_id, arr);
  }

  const targets = collectMatchTargets(opts.predicate);
  const learnedByRow = new Map<string, string[]>();
  if (targets.moves.length > 0) {
    const movePh = targets.moves.map(() => "?").join(",");
    const learnsetRows = db
      .prepare(
        `SELECT species_id, move_id FROM learnsets WHERE species_id IN (${placeholders}) AND move_id IN (${movePh})`,
      )
      .all(...ids, ...targets.moves) as LearnsetRow[];
    for (const l of learnsetRows) {
      const arr = learnedByRow.get(l.species_id) ?? [];
      arr.push(l.move_id);
      learnedByRow.set(l.species_id, arr);
    }
  }

  const results: SpeciesResult[] = rows.map((r) => {
    const types = typesByid.get(r.id) ?? [];
    const abilities = abilitiesById.get(r.id) ?? [];
    const baseStats = { hp: r.hp, atk: r.atk, def: r.def, spa: r.spa, spd: r.spd, spe: r.spe };
    const matchReasons = computeMatchReasons(
      targets,
      { types, abilities: abilities.map((a) => a.name), baseStats },
      learnedByRow.get(r.id) ?? [],
    );
    return {
      id: r.id,
      name: r.name,
      types,
      abilities,
      baseStats,
      isMega: r.is_mega === 1,
      baseSpecies: r.base_species,
      matchReasons,
    };
  });

  return {
    total: results.length,
    results,
    format: format ? { id: format.id, name: format.name } : null,
  };
}

function buildFormatClauses(format: Format, params: unknown[]): string {
  const parts: string[] = [];

  if (!format.mechanics.megaEvolution) {
    parts.push("s.is_mega = 0");
  }

  if (format.maxRestricted === 0 && format.restrictedSpecies.size > 0) {
    const ph = Array.from(format.restrictedSpecies).map(() => "?").join(",");
    params.push(...format.restrictedSpecies);
    parts.push(`s.id NOT IN (${ph})`);
  }

  if (format.useSpeciesPool) {
    params.push(format.id);
    parts.push("s.id IN (SELECT species_id FROM species_format_legality WHERE format_id = ?)");
  }

  if (format.speciesBanlist.size > 0) {
    const ph = Array.from(format.speciesBanlist).map(() => "?").join(",");
    params.push(...format.speciesBanlist);
    parts.push(`s.id NOT IN (${ph})`);
  }

  if (format.speciesAllowlist) {
    const ph = Array.from(format.speciesAllowlist).map(() => "?").join(",");
    params.push(...format.speciesAllowlist);
    parts.push(`s.id IN (${ph})`);
  }

  return parts.length > 0 ? parts.join(" AND ") : "";
}
