import { z } from "zod";
import type { Predicate } from "@pokequery/core";

const POKEMON_TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
  "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
  "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
] as const;

const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
const COMPARISON_OPS = ["eq", "neq", "lt", "lte", "gt", "gte"] as const;

const idSchema = z.string().min(1).max(64).regex(/^[a-z0-9]+$/, "must be a valid id");

export const predicateSchema: z.ZodType<Predicate, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("and"), children: z.array(predicateSchema).max(50) }),
    z.object({ kind: z.literal("or"), children: z.array(predicateSchema).max(50) }),
    z.object({ kind: z.literal("not"), child: predicateSchema }),
    z.object({ kind: z.literal("learnsMove"), moveId: idSchema }),
    z.object({ kind: z.literal("hasType"), type: z.enum(POKEMON_TYPES) }),
    z.object({ kind: z.literal("hasAbility"), abilityId: idSchema }),
    z.object({ kind: z.literal("hasAnyAbility"), abilityIds: z.array(idSchema).min(1).max(20) }),
    z.object({ kind: z.literal("isMega") }),
    z.object({
      kind: z.literal("statCompare"),
      stat: z.enum(STAT_KEYS),
      op: z.enum(COMPARISON_OPS),
      value: z.number().int().min(0).max(255),
    }),
    z.object({
      kind: z.literal("immuneToType"),
      type: z.enum(POKEMON_TYPES),
      allowAbilities: z.boolean().default(true),
    }),
    z.object({ kind: z.literal("partnerSpreadImmuneTo") }),
    z.object({ kind: z.literal("speciesId"), id: idSchema }),
    z.object({ kind: z.literal("notSpeciesId"), id: idSchema }),
  ]),
);

export const querySchema = z.object({
  predicate: predicateSchema,
  formatId: z.string().min(1).max(64).optional(),
  limit: z.number().int().min(1).max(500).default(100),
  sortBy: z.enum(["name", "spe", "hp", "atk", "def", "spa", "spd"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export type QueryRequest = z.infer<typeof querySchema>;
