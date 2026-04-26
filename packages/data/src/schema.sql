CREATE TABLE IF NOT EXISTS species (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  num INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  atk INTEGER NOT NULL,
  def INTEGER NOT NULL,
  spa INTEGER NOT NULL,
  spd INTEGER NOT NULL,
  spe INTEGER NOT NULL,
  weight REAL NOT NULL,
  is_mega INTEGER NOT NULL DEFAULT 0,
  is_natdex INTEGER NOT NULL DEFAULT 0,
  base_species TEXT,
  hidden_ability TEXT
);

CREATE TABLE IF NOT EXISTS species_types (
  species_id TEXT NOT NULL,
  type TEXT NOT NULL,
  slot INTEGER NOT NULL,
  PRIMARY KEY (species_id, slot),
  FOREIGN KEY (species_id) REFERENCES species(id)
);

CREATE TABLE IF NOT EXISTS species_abilities (
  species_id TEXT NOT NULL,
  ability TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (species_id, ability),
  FOREIGN KEY (species_id) REFERENCES species(id)
);

CREATE TABLE IF NOT EXISTS moves (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  base_power INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,
  pp INTEGER NOT NULL,
  priority INTEGER NOT NULL,
  target TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS move_flags (
  move_id TEXT NOT NULL,
  flag TEXT NOT NULL,
  PRIMARY KEY (move_id, flag),
  FOREIGN KEY (move_id) REFERENCES moves(id)
);

CREATE TABLE IF NOT EXISTS abilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_mega_stone INTEGER NOT NULL DEFAULT 0,
  mega_evolves TEXT
);

CREATE TABLE IF NOT EXISTS learnsets (
  species_id TEXT NOT NULL,
  move_id TEXT NOT NULL,
  PRIMARY KEY (species_id, move_id),
  FOREIGN KEY (species_id) REFERENCES species(id),
  FOREIGN KEY (move_id) REFERENCES moves(id)
);

CREATE INDEX IF NOT EXISTS idx_learnsets_move ON learnsets(move_id);
CREATE INDEX IF NOT EXISTS idx_species_abilities_ability ON species_abilities(ability);
CREATE INDEX IF NOT EXISTS idx_species_types_type ON species_types(type);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
