import { describe, it, expect } from "vitest";
import {
  and,
  hasAbility,
  hasAnyAbility,
  hasType,
  immuneToType,
  isMega,
  learnsMove,
  not,
  or,
  speciesId,
  statCompare,
} from "./ast.js";
import {
  fakeOutImmune,
  intimidateImmune,
  isWeatherSetter,
  partnerSpreadImmuneTo,
  redirectionUser,
  speedControlUser,
} from "./composite.js";
import { compilePredicate } from "./compile.js";

describe("compilePredicate", () => {
  it("should compile a learnsMove predicate to a parameterized EXISTS clause", () => {
    const result = compilePredicate(learnsMove("trickroom"));
    expect(result.whereClause).toContain("learnsets");
    expect(result.whereClause).toContain("?");
    expect(result.params).toEqual(["trickroom"]);
  });

  it("should compile a hasType predicate", () => {
    const result = compilePredicate(hasType("Flying"));
    expect(result.whereClause).toContain("species_types");
    expect(result.params).toEqual(["Flying"]);
  });

  it("should compile an AND of multiple predicates", () => {
    const result = compilePredicate(and(learnsMove("trickroom"), hasType("Flying")));
    expect(result.whereClause).toMatch(/AND/);
    expect(result.params).toEqual(["trickroom", "Flying"]);
  });

  it("should compile an OR of multiple predicates", () => {
    const result = compilePredicate(or(hasType("Flying"), hasAbility("levitate")));
    expect(result.whereClause).toMatch(/OR/);
    expect(result.params).toContain("Flying");
    expect(result.params).toContain("levitate");
  });

  it("should compile a NOT predicate", () => {
    const result = compilePredicate(not(hasType("Fire")));
    expect(result.whereClause).toMatch(/^NOT/);
    expect(result.params).toEqual(["Fire"]);
  });

  it("should treat empty AND as always-true and empty OR as always-false", () => {
    expect(compilePredicate({ kind: "and", children: [] }).whereClause).toBe("1=1");
    expect(compilePredicate({ kind: "or", children: [] }).whereClause).toBe("1=0");
  });

  it("should compile immuneToType for Ground including Flying type and Levitate/Earth Eater abilities", () => {
    const result = compilePredicate(immuneToType("Ground"));
    expect(result.params).toContain("Flying");
    expect(result.params).toContain("levitate");
    expect(result.params).toContain("eartheater");
  });

  it("should compile immuneToType for Ground without abilities when allowAbilities is false", () => {
    const result = compilePredicate(immuneToType("Ground", false));
    expect(result.params).toContain("Flying");
    expect(result.params).not.toContain("levitate");
  });

  it("should compile statCompare with the correct operator", () => {
    const result = compilePredicate(statCompare("spe", "lt", 60));
    expect(result.whereClause).toBe("s.spe < ?");
    expect(result.params).toEqual([60]);
  });

  it("should reject invalid stat names in statCompare", () => {
    expect(() =>
      compilePredicate(statCompare("nonexistent" as never, "eq", 100)),
    ).toThrow(/invalid stat/);
  });

  it("should compile isMega to a flag check", () => {
    expect(compilePredicate(isMega()).whereClause).toBe("s.is_mega = 1");
  });

  it("should compile speciesId to an equality check", () => {
    const result = compilePredicate(speciesId("mudsdale"));
    expect(result.whereClause).toBe("s.id = ?");
    expect(result.params).toEqual(["mudsdale"]);
  });

  it("should compile hasAnyAbility with IN clause", () => {
    const result = compilePredicate(hasAnyAbility(["levitate", "telepathy"]));
    expect(result.whereClause).toMatch(/IN \(\?,\?\)/);
    expect(result.params).toEqual(["levitate", "telepathy"]);
  });

  it("should treat empty hasAnyAbility as always-false", () => {
    expect(compilePredicate(hasAnyAbility([])).whereClause).toBe("1=0");
  });

  it("should compile partnerSpreadImmuneTo to immuneToType OR telepathy", () => {
    const result = compilePredicate(partnerSpreadImmuneTo());
    expect(result.whereClause).toMatch(/OR/);
    expect(result.params).toContain("Flying");
    expect(result.params).toContain("levitate");
    expect(result.params).toContain("eartheater");
    expect(result.params).toContain("telepathy");
  });

  it("should compile redirectionUser to followme OR ragepowder", () => {
    const result = compilePredicate(redirectionUser());
    expect(result.whereClause).toMatch(/OR/);
    expect(result.params).toEqual(["followme", "ragepowder"]);
  });

  it("should compile speedControlUser to OR of speed-control moves", () => {
    const result = compilePredicate(speedControlUser());
    expect(result.whereClause).toMatch(/OR/);
    expect(result.params).toEqual([
      "trickroom",
      "tailwind",
      "icywind",
      "electroweb",
      "thunderwave",
    ]);
  });

  it("should compile fakeOutImmune to Inner Focus OR Own Tempo OR Ghost type", () => {
    const result = compilePredicate(fakeOutImmune());
    expect(result.whereClause).toMatch(/OR/);
    expect(result.params).toContain("innerfocus");
    expect(result.params).toContain("owntempo");
    expect(result.params).toContain("Ghost");
  });

  it("should compile intimidateImmune to a single hasAnyAbility IN clause", () => {
    const result = compilePredicate(intimidateImmune());
    expect(result.whereClause).toMatch(/IN \(\?,\?,\?,\?,\?,\?,\?\)/);
    expect(result.params).toEqual([
      "innerfocus",
      "owntempo",
      "oblivious",
      "scrappy",
      "guarddog",
      "defiant",
      "competitive",
    ]);
  });

  it("should compile isWeatherSetter (any) with abilities and moves across all weathers", () => {
    const result = compilePredicate(isWeatherSetter());
    expect(result.whereClause).toContain("species_abilities");
    expect(result.whereClause).toContain("learnsets");
    for (const id of [
      "drizzle",
      "drought",
      "sandstream",
      "snowwarning",
      "sunnyday",
      "raindance",
      "sandstorm",
      "snowscape",
      "chillyreception",
    ]) {
      expect(result.params).toContain(id);
    }
    expect(result.params).not.toContain("hadronengine");
  });

  it("should compile isWeatherSetter('rain') restricted to rain abilities and Rain Dance", () => {
    const result = compilePredicate(isWeatherSetter("rain"));
    expect(result.params).toContain("drizzle");
    expect(result.params).toContain("primordialsea");
    expect(result.params).toContain("raindance");
    expect(result.params).not.toContain("drought");
    expect(result.params).not.toContain("sandstream");
    expect(result.params).not.toContain("sunnyday");
  });

  it("should compile isWeatherSetter('rain', 'ability') with abilities only and no move check", () => {
    const result = compilePredicate(isWeatherSetter("rain", "ability"));
    expect(result.params).toContain("drizzle");
    expect(result.params).toContain("primordialsea");
    expect(result.params).not.toContain("raindance");
    expect(result.whereClause).not.toContain("learnsets");
  });

  it("should compile isWeatherSetter('rain', 'prankster') with Prankster + Rain Dance and no rain abilities", () => {
    const result = compilePredicate(isWeatherSetter("rain", "prankster"));
    expect(result.params).toContain("prankster");
    expect(result.params).toContain("raindance");
    expect(result.params).not.toContain("drizzle");
    expect(result.params).not.toContain("primordialsea");
    expect(result.whereClause).toMatch(/AND/);
  });

  it("should nest AND/OR predicates correctly", () => {
    const tree = and(
      learnsMove("trickroom"),
      or(hasType("Flying"), hasAbility("levitate")),
    );
    const result = compilePredicate(tree);
    expect(result.whereClause).toMatch(/AND/);
    expect(result.whereClause).toMatch(/OR/);
    expect(result.params).toEqual(["trickroom", "Flying", "levitate"]);
  });
});
