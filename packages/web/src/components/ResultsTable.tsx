import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Sprites } from "@pkmn/img";
import type { QueryResponse, SpeciesResult } from "../api.js";
import type { Predicate } from "@pokequery/core";
import { ABILITIES_IMMUNE_TO_ATTACK, TYPES_IMMUNE_TO_ATTACK, weatherSetterAbilities } from "@pokequery/core";
import { TypeBadge } from "./TypeBadge.js";

const normId = (s: string) => s.toLowerCase().replace(/\s/g, "");

const MOVE_DISPLAY: Record<string, string> = {
  raindance: "Rain Dance",
  sunnyday: "Sunny Day",
  sandstorm: "Sandstorm",
  snowscape: "Snowscape",
  hail: "Hail",
  chillyreception: "Chilly Reception",
  trickroom: "Trick Room",
  tailwind: "Tailwind",
  icywind: "Icy Wind",
  electroweb: "Electroweb",
  thunderwave: "Thunder Wave",
  followme: "Follow Me",
  ragepowder: "Rage Powder",
};

const prettyMoveName = (id: string): string =>
  MOVE_DISPLAY[id] ?? id.replace(/(^.|\s.)/g, (c) => c.toUpperCase());

interface Highlights {
  types: Set<string>;
  abilityIds: Set<string>;
}

function extractHighlights(p: Predicate): Highlights {
  const types = new Set<string>();
  const abilityIds = new Set<string>();
  function walk(node: Predicate) {
    switch (node.kind) {
      case "and":
      case "or":
        node.children.forEach(walk);
        break;
      case "not":
        walk(node.child);
        break;
      case "hasType":
        types.add(node.type);
        break;
      case "hasAbility":
        abilityIds.add(node.abilityId);
        break;
      case "hasAnyAbility":
        node.abilityIds.forEach((id) => abilityIds.add(id));
        break;
      case "immuneToType":
        TYPES_IMMUNE_TO_ATTACK[node.type].forEach((t) => types.add(t));
        if (node.allowAbilities) {
          ABILITIES_IMMUNE_TO_ATTACK[node.type].forEach((a) => abilityIds.add(normId(a)));
        }
        break;
      case "partnerSpreadImmuneTo":
        TYPES_IMMUNE_TO_ATTACK["Ground"].forEach((t) => types.add(t));
        ABILITIES_IMMUNE_TO_ATTACK["Ground"].forEach((a) => abilityIds.add(normId(a)));
        abilityIds.add("telepathy");
        break;
      case "fakeOutImmune":
        abilityIds.add("innerfocus");
        abilityIds.add("owntempo");
        types.add("Ghost");
        break;
      case "intimidateImmune":
        ["innerfocus", "owntempo", "oblivious", "scrappy", "guarddog", "defiant", "competitive"]
          .forEach((a) => abilityIds.add(a));
        break;
      case "isWeatherSetter":
        if (node.via === "prankster") {
          abilityIds.add("prankster");
        } else {
          for (const a of weatherSetterAbilities(node.weather)) abilityIds.add(a);
        }
        break;
    }
  }
  walk(p);
  return { types, abilityIds };
}

const EMPTY_HIGHLIGHTS: Highlights = { types: new Set(), abilityIds: new Set() };

const col = createColumnHelper<SpeciesResult>();

function makeColumns(hl: Highlights) {
  return [
    col.display({
      id: "sprite",
      header: "",
      cell: (info) => {
        const src = Sprites.getPokemon(info.row.original.id).url;
        return (
          <img
            src={src}
            alt={info.row.original.name}
            className="w-12 h-12 object-contain"
            onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
          />
        );
      },
    }),
    col.accessor("name", {
      header: "Pokémon",
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    col.accessor("types", {
      header: "Types",
      enableSorting: false,
      cell: (info) => (
        <div className="flex gap-1">
          {info.getValue().map((t) => (
            <span
              key={t}
              className={hl.types.has(t) ? "ring-2 ring-indigo-400 ring-offset-1 rounded" : ""}
            >
              <TypeBadge type={t} />
            </span>
          ))}
        </div>
      ),
    }),
    col.accessor("abilities", {
      header: "Abilities",
      enableSorting: false,
      cell: (info) => {
        const matchedMoves = info.row.original.matchReasons.moves;
        return (
          <span className="text-xs text-gray-600">
            {info.getValue().map((a, i) => {
              const matched = hl.abilityIds.has(normId(a.name));
              return (
                <span key={a.name}>
                  {i > 0 && " / "}
                  <span className={matched ? "font-semibold text-indigo-700" : ""}>
                    {a.name}
                  </span>
                </span>
              );
            })}
            {matchedMoves.length > 0 && (
              <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-semibold ring-1 ring-indigo-300 align-middle">
                via {matchedMoves.map(prettyMoveName).join(", ")}
              </span>
            )}
          </span>
        );
      },
    }),
    col.accessor((r) => r.baseStats.hp, { id: "hp", header: "HP" }),
    col.accessor((r) => r.baseStats.atk, { id: "atk", header: "Atk" }),
    col.accessor((r) => r.baseStats.def, { id: "def", header: "Def" }),
    col.accessor((r) => r.baseStats.spa, { id: "spa", header: "SpA" }),
    col.accessor((r) => r.baseStats.spd, { id: "spd", header: "SpD" }),
    col.accessor((r) => r.baseStats.spe, { id: "spe", header: "Spe" }),
    col.accessor(
      (r) => r.baseStats.hp + r.baseStats.atk + r.baseStats.def + r.baseStats.spa + r.baseStats.spd + r.baseStats.spe,
      { id: "bst", header: "BST" },
    ),
  ];
}

export function ResultsTable({ data, predicate }: { data: QueryResponse; predicate?: Predicate }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const highlights = useMemo(
    () => (predicate ? extractHighlights(predicate) : EMPTY_HIGHLIGHTS),
    [predicate],
  );
  const columns = useMemo(() => makeColumns(highlights), [highlights]);

  const table = useReactTable({
    data: data.results,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-100 text-sm text-gray-500">
        {data.total} result{data.total !== 1 ? "s" : ""}
        {data.format && <span className="ml-2 text-indigo-600">· {data.format.name}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-gray-50 border-b border-gray-100">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap select-none"
                    style={{ cursor: h.column.getCanSort() ? "pointer" : "default" }}
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" && " ↑"}
                    {h.column.getIsSorted() === "desc" && " ↓"}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-1">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
