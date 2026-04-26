import type { Predicate, PokemonType, StatKey, ComparisonOp } from "@pokequery/core";
import type { MoveInfo, AbilityInfo } from "../api.js";
import { Typeahead } from "./Typeahead.js";

const POKEMON_TYPES: PokemonType[] = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
  "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
  "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
];

const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
const STAT_LABELS: Record<StatKey, string> = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
const OP_LABELS: Record<ComparisonOp, string> = { eq: "=", neq: "≠", lt: "<", lte: "≤", gt: ">", gte: "≥" };
const OPS: ComparisonOp[] = ["lt", "lte", "eq", "neq", "gte", "gt"];

type SupportedLeafKind = "learnsMove" | "hasType" | "hasAbility" | "immuneToType" | "partnerSpreadImmuneTo" | "statCompare" | "isMega";

const LEAF_LABELS: Record<SupportedLeafKind, string> = {
  learnsMove: "Learns move",
  hasType: "Has type",
  hasAbility: "Has ability",
  immuneToType: "Immune to type",
  partnerSpreadImmuneTo: "Immune to partner-spread",
  statCompare: "Stat comparison",
  isMega: "Is Mega",
};

const LEAF_DEFAULTS: Record<SupportedLeafKind, Predicate> = {
  learnsMove: { kind: "learnsMove", moveId: "" },
  hasType: { kind: "hasType", type: "Normal" },
  hasAbility: { kind: "hasAbility", abilityId: "" },
  immuneToType: { kind: "immuneToType", type: "Ground", allowAbilities: true },
  partnerSpreadImmuneTo: { kind: "partnerSpreadImmuneTo" },
  statCompare: { kind: "statCompare", stat: "spe", op: "lt", value: 60 },
  isMega: { kind: "isMega" },
};

function isSupportedLeaf(p: Predicate): p is Extract<Predicate, { kind: SupportedLeafKind }> {
  return p.kind in LEAF_DEFAULTS;
}

interface BuilderProps {
  predicate: Predicate;
  onChange: (p: Predicate) => void;
  moves: MoveInfo[];
  abilities: AbilityInfo[];
}

export function PredicateBuilder({ predicate, onChange, moves, abilities }: BuilderProps) {
  const root = predicate.kind === "and" || predicate.kind === "or" ? predicate : { kind: "and" as const, children: [predicate] };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Filters</h2>
      <GroupNode
        predicate={root}
        onChange={onChange}
        moves={moves}
        abilities={abilities}
        depth={0}
      />
    </div>
  );
}

interface GroupProps {
  predicate: Extract<Predicate, { kind: "and" | "or" }>;
  onChange: (p: Predicate) => void;
  onRemove?: () => void;
  moves: MoveInfo[];
  abilities: AbilityInfo[];
  depth: number;
}

function GroupNode({ predicate, onChange, onRemove, moves, abilities, depth }: GroupProps) {
  const addLeaf = () =>
    onChange({ ...predicate, children: [...predicate.children, { kind: "learnsMove", moveId: "" }] });

  const addGroup = () =>
    onChange({ ...predicate, children: [...predicate.children, { kind: "and", children: [] }] });

  const updateChild = (i: number, child: Predicate) =>
    onChange({ ...predicate, children: predicate.children.map((c, j) => (j === i ? child : c)) });

  const removeChild = (i: number) =>
    onChange({ ...predicate, children: predicate.children.filter((_, j) => j !== i) });

  return (
    <div className={depth > 0 ? "border-l-2 border-indigo-200 pl-3 mt-1" : ""}>
      <div className="flex items-center gap-2 mb-2">
        <select
          className="border border-gray-300 rounded px-2 py-0.5 text-xs font-semibold bg-white text-indigo-700 focus:outline-none"
          value={predicate.kind}
          onChange={(e) => onChange({ ...predicate, kind: e.target.value as "and" | "or" })}
        >
          <option value="and">ALL of (AND)</option>
          <option value="or">ANY of (OR)</option>
        </select>
        {onRemove && (
          <button
            type="button"
            className="text-gray-400 hover:text-red-500 text-xs"
            onClick={onRemove}
          >
            Remove group
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {predicate.children.map((child, i) => (
          <ChildNode
            key={i}
            predicate={child}
            onChange={(p) => updateChild(i, p)}
            onRemove={() => removeChild(i)}
            moves={moves}
            abilities={abilities}
            depth={depth + 1}
          />
        ))}
      </div>

      {predicate.children.length === 0 && (
        <p className="text-xs text-gray-400 italic py-1">No filters — matches everything.</p>
      )}

      <div className="flex gap-2 mt-2">
        <button
          type="button"
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          onClick={addLeaf}
        >
          + Add filter
        </button>
        <button
          type="button"
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          onClick={addGroup}
        >
          + Add group
        </button>
      </div>
    </div>
  );
}

interface ChildProps {
  predicate: Predicate;
  onChange: (p: Predicate) => void;
  onRemove: () => void;
  moves: MoveInfo[];
  abilities: AbilityInfo[];
  depth: number;
}

function ChildNode({ predicate, onChange, onRemove, moves, abilities, depth }: ChildProps) {
  if (predicate.kind === "and" || predicate.kind === "or") {
    return (
      <GroupNode
        predicate={predicate}
        onChange={onChange}
        onRemove={onRemove}
        moves={moves}
        abilities={abilities}
        depth={depth}
      />
    );
  }

  const isNot = predicate.kind === "not";
  const inner = isNot ? predicate.child : predicate;

  const handleNotToggle = (checked: boolean) => {
    if (checked) onChange({ kind: "not", child: inner });
    else onChange(inner);
  };

  const handleInnerChange = (p: Predicate) => {
    onChange(isNot ? { kind: "not", child: p } : p);
  };

  return (
    <div className="flex items-start gap-2 bg-gray-50 rounded px-2 py-1.5">
      <label className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 shrink-0 cursor-pointer">
        <input
          type="checkbox"
          className="rounded"
          checked={isNot}
          onChange={(e) => handleNotToggle(e.target.checked)}
        />
        NOT
      </label>
      <div className="flex-1 min-w-0">
        <LeafEditor predicate={inner} onChange={handleInnerChange} moves={moves} abilities={abilities} />
      </div>
      <button
        type="button"
        className="text-gray-400 hover:text-red-500 text-sm leading-none mt-0.5 shrink-0"
        onClick={onRemove}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

interface LeafProps {
  predicate: Predicate;
  onChange: (p: Predicate) => void;
  moves: MoveInfo[];
  abilities: AbilityInfo[];
}

function LeafEditor({ predicate, onChange, moves, abilities }: LeafProps) {
  const currentKind = isSupportedLeaf(predicate) ? predicate.kind : "learnsMove";

  const handleKindChange = (kind: SupportedLeafKind) => {
    const def = LEAF_DEFAULTS[kind];
    if (def) onChange(def);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 shrink-0"
        value={currentKind}
        onChange={(e) => handleKindChange(e.target.value as SupportedLeafKind)}
      >
        {(Object.entries(LEAF_LABELS) as [SupportedLeafKind, string][]).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>

      <ConditionInputs predicate={predicate} onChange={onChange} moves={moves} abilities={abilities} />
    </div>
  );
}

function ConditionInputs({ predicate, onChange, moves, abilities }: LeafProps) {
  const cls = "border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400";

  switch (predicate.kind) {
    case "learnsMove":
      return (
        <Typeahead
          items={moves}
          value={predicate.moveId}
          onChange={(id) => onChange({ ...predicate, moveId: id })}
          placeholder="Move name…"
          className="w-40"
        />
      );

    case "hasType":
      return (
        <select
          className={cls}
          value={predicate.type}
          onChange={(e) => onChange({ ...predicate, type: e.target.value as PokemonType })}
        >
          {POKEMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      );

    case "hasAbility":
      return (
        <Typeahead
          items={abilities}
          value={predicate.abilityId}
          onChange={(id) => onChange({ ...predicate, abilityId: id })}
          placeholder="Ability name…"
          className="w-40"
        />
      );

    case "immuneToType":
      return (
        <>
          <select
            className={cls}
            value={predicate.type}
            onChange={(e) => onChange({ ...predicate, type: e.target.value as PokemonType })}
          >
            {POKEMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={predicate.allowAbilities}
              onChange={(e) => onChange({ ...predicate, allowAbilities: e.target.checked })}
            />
            incl. abilities
          </label>
        </>
      );

    case "partnerSpreadImmuneTo":
      return null;

    case "statCompare":
      return (
        <>
          <select
            className={cls}
            value={predicate.stat}
            onChange={(e) => onChange({ ...predicate, stat: e.target.value as StatKey })}
          >
            {STAT_KEYS.map((s) => <option key={s} value={s}>{STAT_LABELS[s]}</option>)}
          </select>
          <select
            className={cls}
            value={predicate.op}
            onChange={(e) => onChange({ ...predicate, op: e.target.value as ComparisonOp })}
          >
            {OPS.map((op) => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
          </select>
          <input
            type="number"
            className={`${cls} w-16`}
            min={0}
            max={255}
            value={predicate.value}
            onChange={(e) => onChange({ ...predicate, value: Number(e.target.value) })}
          />
        </>
      );

    case "isMega":
      return null;

    default:
      return <span className="text-xs text-gray-400">(unsupported condition)</span>;
  }
}
