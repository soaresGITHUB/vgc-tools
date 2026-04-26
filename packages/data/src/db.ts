import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DB_PATH = process.env.POKEQUERY_DB ?? join(__dirname, "../pokequery.db");

export function openDb(path: string = DB_PATH): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function applySchema(db: Database.Database): void {
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
}
