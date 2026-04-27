import type { Predicate } from "@pokequery/core";

export interface UrlState {
  predicate: Predicate;
  formatId?: string;
}

const VERSION = "v1";

export function encodeState(state: UrlState): string {
  const json = JSON.stringify(state);
  const utf8 = new TextEncoder().encode(json);
  let bin = "";
  for (const byte of utf8) bin += String.fromCharCode(byte);
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${VERSION}.${b64}`;
}

export function decodeState(hash: string): UrlState | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (raw.length === 0) return null;
  const params = new URLSearchParams(raw);
  const q = params.get("q") ?? raw;
  const [version, payload] = q.split(".", 2);
  if (version !== VERSION || !payload) return null;
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as unknown;
    if (!isUrlState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isUrlState(value: unknown): value is UrlState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isPredicate(v.predicate)) return false;
  if (v.formatId !== undefined && typeof v.formatId !== "string") return false;
  return true;
}

const KNOWN_KINDS = new Set([
  "and", "or", "not",
  "learnsMove", "hasType", "hasAbility", "hasAnyAbility", "isMega",
  "statCompare", "immuneToType",
  "partnerSpreadImmuneTo", "redirectionUser", "speedControlUser", "fakeOutImmune", "intimidateImmune",
  "speciesId", "notSpeciesId",
]);

function isPredicate(value: unknown): value is Predicate {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.kind !== "string" || !KNOWN_KINDS.has(v.kind)) return false;
  if ((v.kind === "and" || v.kind === "or") && !Array.isArray(v.children)) return false;
  if ((v.kind === "and" || v.kind === "or") && Array.isArray(v.children)) {
    return v.children.every(isPredicate);
  }
  if (v.kind === "not") return isPredicate(v.child);
  return true;
}

export function isEmptyPredicate(p: Predicate): boolean {
  return p.kind === "and" && p.children.length === 0;
}
