# Legal-species allowlists

Each `<format-id>.txt` is the canonical species pool for one VGC regulation. The data ingest reads these files at build time and populates `species_format_legality`.

## Format

- One species ID per line (lowercase, no hyphens — same convention as `@pkmn/data` IDs).
- Lines starting with `#` and blank lines are ignored.
- Mega forme IDs end in `mega`, `megax`, or `megay`.
- Regional forms append the region (e.g. `taurospaldeacombat`, `slowkinggalar`, `arcaninehisui`).
- Unknown IDs (not present in the ingested species table) are logged as warnings and skipped — they don't fail the ingest. This is intentional: official lists may include new Megas that have not yet been added to `@pkmn/data`.

## Sources

| File | Source | Retrieved |
|------|--------|-----------|
| `reg-m-a.txt` | https://www.serebii.net/pokemonchampions/rankedbattle/regulationm-a.shtml | 2026-04-26 |

## Re-curation

When a regulation rotates, replace the corresponding file in full and update the row above with the new retrieval date.
