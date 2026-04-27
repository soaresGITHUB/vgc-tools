import { describe, it, expect } from "vitest";
import { collectMatchTargets, computeMatchReasons } from "./match.js";
import {
  and,
  hasAbility,
  hasType,
  immuneToType,
  learnsMove,
  not,
  or,
  statCompare,
} from "./ast.js";
import { partnerSpreadImmuneTo } from "./composite.js";

const baseStats = { hp: 80, atk: 60, def: 110, spa: 75, spd: 120, spe: 50 };

describe("collectMatchTargets", () => {
  it("should expand partnerSpreadImmuneTo to Flying type and Levitate/Earth Eater/Telepathy abilities", () => {
    const t = collectMatchTargets(partnerSpreadImmuneTo());
    expect(t.types).toContain("Flying");
    expect(t.abilities).toContain("telepathy");
    expect(t.abilities).toContain("levitate");
    expect(t.abilities).toContain("eartheater");
  });

  it("should expand immuneToType(Ground) with abilities", () => {
    const t = collectMatchTargets(immuneToType("Ground", true));
    expect(t.types).toEqual(["Flying"]);
    expect([...t.abilities].sort()).toEqual(["eartheater", "levitate"]);
  });

  it("should not surface targets under a NOT predicate", () => {
    const t = collectMatchTargets(not(learnsMove("trickroom")));
    expect(t.moves).toEqual([]);
  });

  it("should record stat comparisons", () => {
    const t = collectMatchTargets(statCompare("spe", "lt", 60));
    expect(t.stats).toEqual([{ stat: "spe", op: "lt", value: 60 }]);
  });

  it("should walk into AND and OR groups", () => {
    const t = collectMatchTargets(
      and(
        learnsMove("trickroom"),
        or(hasType("Flying"), hasAbility("Telepathy")),
      ),
    );
    expect(t.moves).toEqual(["trickroom"]);
    expect(t.types).toContain("Flying");
    expect(t.abilities).toContain("telepathy");
  });
});

describe("computeMatchReasons", () => {
  it("should report Telepathy as the matching ability for partnerSpreadImmuneTo", () => {
    const targets = collectMatchTargets(partnerSpreadImmuneTo());
    const reasons = computeMatchReasons(
      targets,
      { types: ["Normal", "Psychic"], abilities: ["Telepathy", "Inner Focus"], baseStats },
      [],
    );
    expect(reasons.abilities).toContain("Telepathy");
    expect(reasons.types).toEqual([]);
  });

  it("should report Flying as the matching type for partnerSpreadImmuneTo", () => {
    const targets = collectMatchTargets(partnerSpreadImmuneTo());
    const reasons = computeMatchReasons(
      targets,
      { types: ["Ghost", "Flying"], abilities: ["Aftermath"], baseStats },
      [],
    );
    expect(reasons.types).toEqual(["Flying"]);
    expect(reasons.abilities).toEqual([]);
  });

  it("should not surface anything for a learnsMove wrapped in NOT", () => {
    const targets = collectMatchTargets(not(learnsMove("trickroom")));
    const reasons = computeMatchReasons(
      targets,
      { types: ["Psychic"], abilities: ["Levitate"], baseStats },
      ["trickroom"],
    );
    expect(reasons.moves).toEqual([]);
  });

  it("should report a stat that satisfies the compare", () => {
    const targets = collectMatchTargets(statCompare("spe", "lt", 60));
    const reasons = computeMatchReasons(
      targets,
      { types: ["Psychic"], abilities: [], baseStats },
      [],
    );
    expect(reasons.stats).toEqual(["spe"]);
  });

  it("should not report a stat whose compare is unsatisfied", () => {
    const targets = collectMatchTargets(statCompare("spe", "gt", 100));
    const reasons = computeMatchReasons(
      targets,
      { types: ["Psychic"], abilities: [], baseStats },
      [],
    );
    expect(reasons.stats).toEqual([]);
  });

  it("should report matched moves from the learnedMoves set", () => {
    const targets = collectMatchTargets(learnsMove("trickroom"));
    const reasons = computeMatchReasons(
      targets,
      { types: ["Psychic"], abilities: [], baseStats },
      ["trickroom"],
    );
    expect(reasons.moves).toEqual(["trickroom"]);
  });
});
