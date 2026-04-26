# pokequery

A queryable Pokémon database for VGC team-building. Think Showdown's data layer plus a composable predicate engine: "find Pokémon that learn Trick Room AND are immune to Ground" returns the right set without you having to think about the type chart.

## Status

This is a partial build handed off mid-project. Phases 1–3 are written, Phases 4–5 are not yet started.

| Phase | What | Status |
|-------|------|--------|
| 1 | Monorepo skeleton + SQLite ingestion from `@pkmn/data` | Done, **verified** |
| 2 | Predicate AST + SQL compiler in `@pokequery/core` | Done, **22 tests passing** |
| 3 | Fastify HTTP server (`POST /query`, `/formats`, `/moves`, `/abilities`) | Written, **tests not yet run** |
| 4 | React + Vite frontend with query builder UI | Not started |
| 5 | VGC-specific composite queries (redirection, speed control, Fake Out, etc.) | Not started |

## Architecture

```
packages/
  core/    Shared types, format config, predicate AST, SQL compiler. No runtime deps.
  data/    Ingestion script + SQLite schema + DB helper.
  server/  Fastify API. Depends on core + data.
  web/     React frontend (not yet written). Will depend on core for predicate types.
```

The key abstraction is in `packages/core/src/predicates/`. Predicates are a discriminated union (`learnsMove`, `hasType`, `hasAbility`, `immuneToType`, `statCompare`, plus `and`/`or`/`not` combinators). The compiler in `compile.ts` turns a predicate tree into a parameterized SQL `WHERE` fragment. This lets the frontend send a JSON predicate tree to `POST /query` and the server runs it efficiently against SQLite.

Format-awareness lives in `packages/core/src/format.ts`. Each VGC Reg Set is a `Format` declaring its mechanics (`megaEvolution`, `terastallization`, etc.) and its species/item/ability ban/allow lists. The executor adds format clauses to the predicate's WHERE.

## Design decisions worth knowing

- **Mega data layered from gen 7.** Gen 9's `@pkmn/data` has zero mega stones because Megas didn't exist in S/V. Reg M-A reintroduces them, so `ingest.ts` pulls the gen 9 base data and overlays mega forms + mega stones from gen 7. Mega learnsets inherit from the base species (verified — Charizard-Mega-Y has the same 129 moves as Charizard).
- **Telepathy is *not* in the base ground-immunity table** in `typechart.ts`. Telepathy only blocks ally damage in doubles — it's a partner-context immunity. Modeling it as general ground-immunity would mislead. Phase 5 should add a `partnerSpreadImmuneTo(type)` predicate that includes Telepathy and is the correct answer to "good Mudsdale partner that won't eat its EQ."
- **Iron Ball, Gravity, Tera, Smack Down, Roost mid-turn grounding are deliberately not modeled.** Per the user's call: when you opt into one of these, you understand the consequences. Modeling them adds field-state complexity for marginal query value.
- **The executor is decoupled from `better-sqlite3`** via a `DbLike` interface (`{ prepare(sql).all(...params) }`). This lets tests use `sql.js`. Production uses `better-sqlite3`, which is structurally compatible.

## Setup

```bash
pnpm install
pnpm --filter @pokequery/data ingest    # builds packages/data/pokequery.db (~1.5s)
pnpm --filter @pokequery/data verify    # sanity-checks the DB
pnpm --filter @pokequery/core test      # 22 tests, all should pass
pnpm --filter @pokequery/server test    # 12 tests, NOT YET VERIFIED — run these first
pnpm --filter @pokequery/server dev     # starts API on :3001
```

Smoke test the API:

```bash
curl -X POST http://localhost:3001/query \
  -H 'Content-Type: application/json' \
  -d '{
    "predicate": {
      "kind": "and",
      "children": [
        {"kind": "learnsMove", "moveId": "trickroom"},
        {"kind": "immuneToType", "type": "Ground", "allowAbilities": true},
        {"kind": "not", "child": {"kind": "isMega"}}
      ]
    },
    "limit": 20
  }'
```

Expect Cresselia, Bronzong, Chimecho, Drifblim, Mesprit, Oranguru, etc.

## What needs verification first

The server tests (`packages/server/test/server.test.ts`) were written but the sandbox couldn't compile `better-sqlite3` natively, so they haven't run. On a normal machine `pnpm install` will succeed. Run them before continuing:

```bash
pnpm --filter @pokequery/server test
```

The most likely failure modes:
1. The `buildApp` signature became async (`Promise<{ app, close }>`) due to the lazy `@pokequery/data` import. The test fixture and `index.ts` main both account for this; just confirm the signature change didn't break anything.
2. Format banlist `Set` serialization — the executor only iterates over the Set, never serializes it, so this should be fine, but worth eyeballing if a test fails.

## Conventions

- TypeScript strict mode, `noUncheckedIndexedAccess`.
- All test names use the `should` prefix, always.
- No comments unless they explain something non-obvious.
- Every file uses ESM (`type: "module"`, `.js` import suffixes for TS source).
- Predicates are pure data — never closures. The compiler is the only place SQL is generated.

## Phase 4 — what's next

Build the React frontend. Stack:
- Vite + React + TypeScript
- TanStack Query for API calls, TanStack Table for results
- Tailwind for styling
- `@pkmn/img` for sprites
- Filter composer UI with AND/OR groups, nested conditions, typeahead for moves and abilities (powered by `/moves` and `/abilities`)
- Format selector at the top of the page (powered by `/formats`)

The frontend should depend on `@pokequery/core` for predicate types — sending malformed predicates should be impossible at the type level.

## Phase 5 — composite queries to add later

Once the predicate engine is wired up end-to-end, add these as either preset queries or higher-level predicates:

- `partnerSpreadImmuneTo(type)` — type immunity OR Levitate OR Earth Eater OR Telepathy (the "Mudsdale-safe partner" query).
- `redirectionUser()` — learns Follow Me or Rage Powder.
- `speedControlUser()` — learns Trick Room, Tailwind, Icy Wind, Electroweb, or Thunder Wave.
- `fakeOutImmune()` — has Inner Focus, Own Tempo, holds Covert Cloak, or is a Ghost type.
- `intimidateImmune()` — Inner Focus, Own Tempo, Oblivious, Scrappy, Guard Dog, or Defiant/Competitive abusers.
- `coversWeaknesses(partnerSpeciesId)` — defensive type synergy, weighted by how many of the partner's weaknesses get resisted.

Each should be a function in `packages/core/src/predicates/composite.ts` that returns a `Predicate` (composable with everything else).
