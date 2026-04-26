import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { Sprites } from "@pkmn/img";
import type { QueryResponse, SpeciesResult } from "../api.js";
import { TypeBadge } from "./TypeBadge.js";

const col = createColumnHelper<SpeciesResult>();

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
    cell: (info) => (
      <div className="flex gap-1">
        {info.getValue().map((t) => <TypeBadge key={t} type={t} />)}
      </div>
    ),
  }),
  col.accessor("abilities", {
    header: "Abilities",
    enableSorting: false,
    cell: (info) => (
      <span className="text-xs text-gray-600">
        {info.getValue().map((a) => a.name).join(" / ")}
      </span>
    ),
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

export function ResultsTable({ data }: { data: QueryResponse }) {
  const [sorting, setSorting] = useState<SortingState>([]);

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
