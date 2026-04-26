import type { Predicate, ComparisonOp } from "./ast.js";
import { hasAbility, immuneToType, or } from "./ast.js";
import { ABILITIES_IMMUNE_TO_ATTACK, TYPES_IMMUNE_TO_ATTACK } from "../typechart.js";

export interface CompiledQuery {
  whereClause: string;
  params: unknown[];
}

const OP_TO_SQL: Record<ComparisonOp, string> = {
  eq: "=",
  neq: "!=",
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
};

const STAT_COLUMNS = new Set(["hp", "atk", "def", "spa", "spd", "spe"]);

export function compilePredicate(predicate: Predicate): CompiledQuery {
  const params: unknown[] = [];
  const whereClause = compileNode(predicate, params);
  return { whereClause, params };
}

function compileNode(p: Predicate, params: unknown[]): string {
  switch (p.kind) {
    case "and":
      if (p.children.length === 0) return "1=1";
      return "(" + p.children.map((c) => compileNode(c, params)).join(" AND ") + ")";
    case "or":
      if (p.children.length === 0) return "1=0";
      return "(" + p.children.map((c) => compileNode(c, params)).join(" OR ") + ")";
    case "not":
      return "NOT (" + compileNode(p.child, params) + ")";
    case "learnsMove":
      params.push(p.moveId);
      return "EXISTS (SELECT 1 FROM learnsets l WHERE l.species_id = s.id AND l.move_id = ?)";
    case "hasType":
      params.push(p.type);
      return "EXISTS (SELECT 1 FROM species_types st WHERE st.species_id = s.id AND st.type = ?)";
    case "hasAbility":
      params.push(p.abilityId);
      return "EXISTS (SELECT 1 FROM species_abilities sa WHERE sa.species_id = s.id AND LOWER(REPLACE(sa.ability, ' ', '')) = ?)";
    case "hasAnyAbility": {
      if (p.abilityIds.length === 0) return "1=0";
      const placeholders = p.abilityIds.map(() => "?").join(",");
      params.push(...p.abilityIds);
      return `EXISTS (SELECT 1 FROM species_abilities sa WHERE sa.species_id = s.id AND LOWER(REPLACE(sa.ability, ' ', '')) IN (${placeholders}))`;
    }
    case "isMega":
      return "s.is_mega = 1";
    case "statCompare": {
      if (!STAT_COLUMNS.has(p.stat)) {
        throw new Error(`invalid stat: ${p.stat}`);
      }
      params.push(p.value);
      return `s.${p.stat} ${OP_TO_SQL[p.op]} ?`;
    }
    case "immuneToType": {
      const immuneTypes = TYPES_IMMUNE_TO_ATTACK[p.type];
      const immuneAbilities = p.allowAbilities ? ABILITIES_IMMUNE_TO_ATTACK[p.type] : [];
      const branches: string[] = [];
      for (const t of immuneTypes) {
        params.push(t);
        branches.push("EXISTS (SELECT 1 FROM species_types st WHERE st.species_id = s.id AND st.type = ?)");
      }
      if (immuneAbilities.length > 0) {
        const ph = immuneAbilities.map(() => "?").join(",");
        params.push(...immuneAbilities.map((a) => a.toLowerCase().replace(/\s/g, "")));
        branches.push(`EXISTS (SELECT 1 FROM species_abilities sa WHERE sa.species_id = s.id AND LOWER(REPLACE(sa.ability, ' ', '')) IN (${ph}))`);
      }
      if (branches.length === 0) return "1=0";
      return "(" + branches.join(" OR ") + ")";
    }
    case "partnerSpreadImmuneTo":
      return compileNode(or(immuneToType("Ground", true), hasAbility("telepathy")), params);
    case "speciesId":
      params.push(p.id);
      return "s.id = ?";
    case "notSpeciesId":
      params.push(p.id);
      return "s.id != ?";
  }
}
