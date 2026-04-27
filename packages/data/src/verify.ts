import { openDb } from "./db.js";

const db = openDb();

interface CountRow { c: number }
interface SimpleRow { [k: string]: unknown }

const counts = [
  ["species", "SELECT COUNT(*) AS c FROM species"],
  ["megas", "SELECT COUNT(*) AS c FROM species WHERE is_mega = 1"],
  ["species_types", "SELECT COUNT(*) AS c FROM species_types"],
  ["species_abilities", "SELECT COUNT(*) AS c FROM species_abilities"],
  ["moves", "SELECT COUNT(*) AS c FROM moves"],
  ["move_flags", "SELECT COUNT(*) AS c FROM move_flags"],
  ["abilities", "SELECT COUNT(*) AS c FROM abilities"],
  ["items", "SELECT COUNT(*) AS c FROM items"],
  ["mega_stones", "SELECT COUNT(*) AS c FROM items WHERE is_mega_stone = 1"],
  ["learnsets", "SELECT COUNT(*) AS c FROM learnsets"],
] as const;

console.log("=== ROW COUNTS ===");
for (const [label, sql] of counts) {
  const row = db.prepare(sql).get() as CountRow;
  console.log(`  ${label.padEnd(20)} = ${row.c}`);
}

console.log("\n=== SANITY: Mudsdale ===");
console.log(db.prepare("SELECT id, name, hp, atk, spe FROM species WHERE id = ?").get("mudsdale"));

console.log("\n=== SANITY: TR + ground-immune ===");
const rows = db.prepare(`
  SELECT DISTINCT s.name, s.spe,
    (SELECT GROUP_CONCAT(type, '/') FROM species_types WHERE species_id = s.id) AS types,
    (SELECT GROUP_CONCAT(ability, ',') FROM species_abilities WHERE species_id = s.id) AS abilities
  FROM species s
  JOIN learnsets l ON l.species_id = s.id AND l.move_id = 'trickroom'
  WHERE s.is_mega = 0
    AND (
      EXISTS (SELECT 1 FROM species_types st WHERE st.species_id = s.id AND st.type = 'Flying')
      OR EXISTS (SELECT 1 FROM species_abilities sa WHERE sa.species_id = s.id AND sa.ability IN ('Levitate', 'Telepathy'))
    )
  ORDER BY s.spe ASC
  LIMIT 10
`).all() as SimpleRow[];
for (const r of rows) {
  console.log(`  ${String(r.name).padEnd(20)} spe=${String(r.spe).padEnd(4)} ${r.types} | ${r.abilities}`);
}

console.log("\n=== HOME-supplemented species in Reg M-A ===");
const HOME_REQUIRED = ["kangaskhan", "pidgeot", "aegislash", "starmie"] as const;
const homeFailures: string[] = [];
for (const id of HOME_REQUIRED) {
  const sp = db.prepare("SELECT id, name FROM species WHERE id = ?").get(id) as SimpleRow | undefined;
  if (!sp) { homeFailures.push(`${id}: not in species table`); continue; }
  const legal = db
    .prepare("SELECT 1 FROM species_format_legality WHERE species_id = ? AND format_id = ?")
    .get(id, "vgc-2026-reg-m-a");
  if (!legal) { homeFailures.push(`${id}: not legal in vgc-2026-reg-m-a`); continue; }
  console.log(`  ${id.padEnd(20)} OK (${sp.name})`);
}
if (homeFailures.length > 0) {
  console.error("\nHOME assertions FAILED:");
  for (const f of homeFailures) console.error(`  - ${f}`);
  process.exitCode = 1;
}

console.log("\n=== META ===");
console.log(db.prepare("SELECT key, value FROM meta").all());

db.close();
