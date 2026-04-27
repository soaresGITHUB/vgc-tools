import type { Predicate } from "./ast.js";

export function partnerSpreadImmuneTo(): Predicate {
  return { kind: "partnerSpreadImmuneTo" };
}

export function redirectionUser(): Predicate {
  return { kind: "redirectionUser" };
}

export function speedControlUser(): Predicate {
  return { kind: "speedControlUser" };
}

export function fakeOutImmune(): Predicate {
  return { kind: "fakeOutImmune" };
}

export function intimidateImmune(): Predicate {
  return { kind: "intimidateImmune" };
}
