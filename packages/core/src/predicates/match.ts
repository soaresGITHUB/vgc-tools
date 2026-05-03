import type { Predicate, ComparisonOp } from "./ast.js";
import type { PokemonType, StatKey, Stats } from "../types.js";
import { TYPES_IMMUNE_TO_ATTACK, ABILITIES_IMMUNE_TO_ATTACK } from "../typechart.js";
import { weatherSetterAbilities, weatherSetterMoves } from "./weather.js";

export interface StatCondition {
  stat: StatKey;
  op: ComparisonOp;
  value: number;
}

export interface MatchTargets {
  moves: string[];
  abilities: string[];
  types: PokemonType[];
  stats: StatCondition[];
}

export interface MatchReasons {
  moves: string[];
  abilities: string[];
  types: PokemonType[];
  stats: StatKey[];
}

export interface RowFeatures {
  types: PokemonType[];
  abilities: string[];
  baseStats: Stats;
}

const normalizeAbility = (s: string): string => s.toLowerCase().replace(/\s/g, "");

const dedup = <T>(xs: T[]): T[] => Array.from(new Set(xs));

export function collectMatchTargets(predicate: Predicate): MatchTargets {
  const acc: MatchTargets = { moves: [], abilities: [], types: [], stats: [] };
  walk(predicate, acc, false);
  return {
    moves: dedup(acc.moves),
    abilities: dedup(acc.abilities),
    types: dedup(acc.types),
    stats: acc.stats,
  };
}

function walk(p: Predicate, t: MatchTargets, negated: boolean): void {
  if (negated) return;
  switch (p.kind) {
    case "and":
    case "or":
      for (const c of p.children) walk(c, t, false);
      return;
    case "not":
      walk(p.child, t, true);
      return;
    case "learnsMove":
      t.moves.push(p.moveId);
      return;
    case "hasType":
      t.types.push(p.type);
      return;
    case "hasAbility":
      t.abilities.push(normalizeAbility(p.abilityId));
      return;
    case "hasAnyAbility":
      for (const a of p.abilityIds) t.abilities.push(normalizeAbility(a));
      return;
    case "immuneToType":
      for (const ty of TYPES_IMMUNE_TO_ATTACK[p.type]) t.types.push(ty);
      if (p.allowAbilities) {
        for (const a of ABILITIES_IMMUNE_TO_ATTACK[p.type]) t.abilities.push(normalizeAbility(a));
      }
      return;
    case "partnerSpreadImmuneTo":
      for (const ty of TYPES_IMMUNE_TO_ATTACK.Ground) t.types.push(ty);
      for (const a of ABILITIES_IMMUNE_TO_ATTACK.Ground) t.abilities.push(normalizeAbility(a));
      t.abilities.push("telepathy");
      return;
    case "isWeatherSetter":
      if (p.via === "ability") {
        for (const a of weatherSetterAbilities(p.weather)) t.abilities.push(a);
      } else if (p.via === "prankster") {
        t.abilities.push("prankster");
        for (const m of weatherSetterMoves(p.weather)) t.moves.push(m);
      } else {
        for (const a of weatherSetterAbilities(p.weather)) t.abilities.push(a);
        for (const m of weatherSetterMoves(p.weather)) t.moves.push(m);
      }
      return;
    case "statCompare":
      t.stats.push({ stat: p.stat, op: p.op, value: p.value });
      return;
    case "isMega":
    case "speciesId":
    case "notSpeciesId":
      return;
  }
}

const OP_FNS: Record<ComparisonOp, (a: number, b: number) => boolean> = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
};

export function computeMatchReasons(
  targets: MatchTargets,
  row: RowFeatures,
  learnedMoves: Iterable<string>,
): MatchReasons {
  const learnedSet = new Set(learnedMoves);
  const moves = targets.moves.filter((m) => learnedSet.has(m));

  const rowTypes = new Set(row.types);
  const types = targets.types.filter((t) => rowTypes.has(t));

  const abilityByNorm = new Map<string, string>();
  for (const a of row.abilities) abilityByNorm.set(normalizeAbility(a), a);
  const abilities: string[] = [];
  for (const a of targets.abilities) {
    const display = abilityByNorm.get(a);
    if (display !== undefined) abilities.push(display);
  }

  const stats: StatKey[] = [];
  for (const c of targets.stats) {
    if (OP_FNS[c.op](row.baseStats[c.stat], c.value)) stats.push(c.stat);
  }

  return {
    moves: dedup(moves),
    abilities: dedup(abilities),
    types: dedup(types),
    stats: dedup(stats),
  };
}
