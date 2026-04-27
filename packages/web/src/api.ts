import type { MatchReasons, PokemonType, Predicate } from "@pokequery/core";

export interface SpeciesResult {
  id: string;
  name: string;
  types: PokemonType[];
  abilities: Array<{ name: string; isHidden: boolean }>;
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  isMega: boolean;
  baseSpecies: string | null;
  matchReasons: MatchReasons;
}

export interface QueryResponse {
  total: number;
  results: SpeciesResult[];
  format: { id: string; name: string } | null;
}

export interface FormatInfo {
  id: string;
  name: string;
  generation: number;
  mechanics: {
    terastallization: boolean;
    megaEvolution: boolean;
    dynamax: boolean;
    zMoves: boolean;
  };
}

export interface MoveInfo {
  id: string;
  name: string;
  type: string;
}

export interface AbilityInfo {
  id: string;
  name: string;
  description: string;
}

export interface QueryRequest {
  predicate: Predicate;
  formatId?: string;
  limit?: number;
  sortBy?: "name" | "spe" | "hp" | "atk" | "def" | "spa" | "spd";
  sortDir?: "asc" | "desc";
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string }).error ?? res.statusText;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const fetchFormats = (): Promise<FormatInfo[]> => apiFetch("/formats");
export const fetchMoves = (): Promise<MoveInfo[]> => apiFetch("/moves");
export const fetchAbilities = (): Promise<AbilityInfo[]> => apiFetch("/abilities");

export function fetchQuery(req: QueryRequest): Promise<QueryResponse> {
  return apiFetch("/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}
