# Claude Code instructions for this project

## Project conventions (must follow)

- All test names use the `should` prefix, always. No exceptions.
- Don't run git commands.
- Don't add comments unless they explain something genuinely non-obvious.
- When adding tests, run them.
- After significant changes, run a typecheck (`pnpm -r build`) and the test suite. Fix any failures.
- Don't change established patterns unless explicitly asked.
- ESM everywhere. Use `.js` suffixes in TS imports (the project compiles with `moduleResolution: "Bundler"`).
- TypeScript strict mode is on, including `noUncheckedIndexedAccess` and `noImplicitOverride`.
- Don't look inside helm-values packages.

## Architecture quick-ref

`packages/core` — pure logic, no runtime deps. Houses the predicate AST and SQL compiler. Both the server and the (future) frontend depend on it for types.

`packages/data` — SQLite schema + ingestion from `@pkmn/data`. One-shot script. Re-run on Reg Set rotation.

`packages/server` — Fastify API. The executor in `src/executor.ts` is decoupled from `better-sqlite3` via a `DbLike` interface so tests can use `sql.js`.

`packages/web` — not yet built. Phase 4.

## Domain rules baked into the design

These came from explicit user decisions during design — don't undo them without asking:

1. **Iron Ball, Gravity, Tera, Smack Down, mid-turn Roost** are NOT modeled as ground-immunity-affecting. The user opts into these knowingly; modeling them adds field-state complexity for no query value.
2. **Telepathy is NOT in the base `ABILITIES_IMMUNE_TO_ATTACK` table** for Ground. Telepathy only blocks ally damage in doubles. It belongs in a separate `partnerSpreadImmuneTo` predicate (Phase 5).
3. **Mega forms inherit learnsets from their base species** at ingestion time. Mega forme IDs end in `mega`, `megax`, or `megay`.
4. **Format-aware queries are the default.** Every query can be scoped by `formatId`. The executor adds format clauses to the WHERE based on `Format.mechanics` and ban/allow lists.

## Pickup checklist

Before doing anything else in a fresh session:

1. `pnpm install`
2. `pnpm --filter @pokequery/data ingest` (builds `packages/data/pokequery.db`)
3. `pnpm --filter @pokequery/core test` — should be 22/22 green
4. `pnpm --filter @pokequery/server test` — **NOT YET VERIFIED**, run and fix anything that breaks
5. Then Phase 4.

If `better-sqlite3` fails to compile, the user is on Node 22 which is supported — confirm Python and a C++ toolchain are available, or pin to an older `better-sqlite3` that ships prebuilds for the user's Node version.
