export type PokemonType =
  | "Normal" | "Fire" | "Water" | "Electric" | "Grass" | "Ice"
  | "Fighting" | "Poison" | "Ground" | "Flying" | "Psychic" | "Bug"
  | "Rock" | "Ghost" | "Dragon" | "Dark" | "Steel" | "Fairy";

export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

export type Stats = Record<StatKey, number>;

export interface Species {
  id: string;
  name: string;
  types: PokemonType[];
  baseStats: Stats;
  abilities: string[];
  hiddenAbility: string | null;
  weight: number;
  isMega: boolean;
  baseSpecies: string | null;
}

export type MoveCategory = "Physical" | "Special" | "Status";

export type MoveTarget =
  | "normal"
  | "self"
  | "allAdjacent"
  | "allAdjacentFoes"
  | "allySide"
  | "foeSide"
  | "all"
  | "any"
  | "allyTeam"
  | "scripted"
  | "randomNormal"
  | "adjacentAlly"
  | "adjacentAllyOrSelf"
  | "adjacentFoe";

export interface Move {
  id: string;
  name: string;
  type: PokemonType;
  category: MoveCategory;
  basePower: number;
  accuracy: number | true;
  pp: number;
  priority: number;
  target: MoveTarget;
  flags: Record<string, 1>;
  description: string;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  isMegaStone: boolean;
  megaEvolves: string | null;
}

export interface LearnsetEntry {
  speciesId: string;
  moveId: string;
}
