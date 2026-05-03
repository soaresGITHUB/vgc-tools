import type { PokemonType, StatKey } from "../types.js";

export type ComparisonOp = "eq" | "neq" | "lt" | "lte" | "gt" | "gte";

export type Weather = "sun" | "rain" | "sand" | "snow";

export type WeatherSetterVia = "ability" | "prankster";

export type Predicate =
  | { kind: "and"; children: Predicate[] }
  | { kind: "or"; children: Predicate[] }
  | { kind: "not"; child: Predicate }
  | { kind: "learnsMove"; moveId: string }
  | { kind: "hasType"; type: PokemonType }
  | { kind: "hasAbility"; abilityId: string }
  | { kind: "hasAnyAbility"; abilityIds: string[] }
  | { kind: "isMega" }
  | { kind: "statCompare"; stat: StatKey; op: ComparisonOp; value: number }
  | { kind: "immuneToType"; type: PokemonType; allowAbilities: boolean }
  | { kind: "partnerSpreadImmuneTo" }
  | { kind: "redirectionUser" }
  | { kind: "speedControlUser" }
  | { kind: "fakeOutImmune" }
  | { kind: "intimidateImmune" }
  | { kind: "isWeatherSetter"; weather?: Weather; via?: WeatherSetterVia }
  | { kind: "speciesId"; id: string }
  | { kind: "notSpeciesId"; id: string };

export const and = (...children: Predicate[]): Predicate => ({ kind: "and", children });
export const or = (...children: Predicate[]): Predicate => ({ kind: "or", children });
export const not = (child: Predicate): Predicate => ({ kind: "not", child });
export const learnsMove = (moveId: string): Predicate => ({ kind: "learnsMove", moveId });
export const hasType = (type: PokemonType): Predicate => ({ kind: "hasType", type });
export const hasAbility = (abilityId: string): Predicate => ({ kind: "hasAbility", abilityId });
export const hasAnyAbility = (abilityIds: string[]): Predicate => ({ kind: "hasAnyAbility", abilityIds });
export const isMega = (): Predicate => ({ kind: "isMega" });
export const statCompare = (stat: StatKey, op: ComparisonOp, value: number): Predicate =>
  ({ kind: "statCompare", stat, op, value });
export const immuneToType = (type: PokemonType, allowAbilities = true): Predicate =>
  ({ kind: "immuneToType", type, allowAbilities });
export const speciesId = (id: string): Predicate => ({ kind: "speciesId", id });
export const notSpeciesId = (id: string): Predicate => ({ kind: "notSpeciesId", id });
