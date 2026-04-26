import type { Predicate } from "./ast.js";

export function partnerSpreadImmuneTo(): Predicate {
  return { kind: "partnerSpreadImmuneTo" };
}
