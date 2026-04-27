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
import type { StatKey } from "@pokequery/core";
import type { QueryResponse, SpeciesResult } from "../api.js";
import { TypeBadge } from "./TypeBadge.js";

const col = createColumnHelper<SpeciesResult>();

const normalizeAbility = (s: string): string => s.toLowerCase().replace(/\s/g, "");

function buildColumns(showMatchedMoves: boolean) {
  const columns = [
    col.display({
      id: "sprite",
      header: "",
      cell: (info) => {
        const id = info.row.original.id;
        const src = Sprites.getPokemon(id).url;
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
      cell: (info) => {
        const matched = new Set(info.row.original.matchReasons.types);
        return (
          <div className="flex gap-1">
            {info.getValue().map((t) => (
              <TypeBadge key={t} type={t} matched={matched.has(t)} />
            ))}
          </div>
        );
      },
    }),
    col.accessor("abilities", {
      header: "Abilities",
      enableSorting: false,
      cell: (info) => {
        const matched = new Set(
          info.row.original.matchReasons.abilities.map(normalizeAbility),
        );
        return (
          <span className="text-xs text-gray-600 flex flex-wrap gap-1">
            {info.getValue().map((a, i) => {
              const isMatched = matched.has(normalizeAbility(a.name));
              return (
                <span
                  key={a.name + i}
                  className={
                    isMatched
                      ? "px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold ring-1 ring-indigo-300"
                      : ""
                  }
                >
                  {a.name}
                </span>
              );
            })}
          </span>
        );
      },
    }),
  ];

  const statKeys: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
  const statHeaders: Record<StatKey, string> = {
    hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe",
  };
  for (const key of statKeys) {
    columns.push(
      col.accessor((r) => r.baseStats[key], {
        id: key,
        header: statHeaders[key],
        cell: (info) => {
          const matched = info.row.original.matchReasons.stats.includes(key);
          return (
            <span
              className={
                matched
                  ? "inline-block px-1 rounded bg-indigo-100 text-indigo-800 font-semibold"
                  : undefined
              }
            >
              {info.getValue() as number}
            </span>
          );
        },
      }) as never,
    );
  }
  columns.push(
    col.accessor(
      (r) => r.baseStats.hp + r.baseStats.atk + r.baseStats.def + r.baseStats.spa + r.baseStats.spd + r.baseStats.spe,
      { id: "bst", header: "BST" },
    ) as never,
  );

  if (showMatchedMoves) {
    columns.push(
      col.display({
        id: "matchedMoves",
        header: "Matched moves",
        cell: (info) => {
          const moves = info.row.original.matchReasons.moves;
          if (moves.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1">
              {moves.map((m) => (
                <span
                  key={m}
                  className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs font-semibold ring-1 ring-indigo-300"
                >
                  {m}
                </span>
              ))}
            </div>
          );
        },
      }) as never,
    );
  }

  return columns;
}

export function ResultsTable({ data }: { data: QueryResponse }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const showMatchedMoves = useMemo(
    () => data.results.some((r) => r.matchReasons.moves.length > 0),
    [data.results],
  );
  const columns = useMemo(() => buildColumns(showMatchedMoves), [showMatchedMoves]);

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
