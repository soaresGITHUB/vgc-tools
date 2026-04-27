import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Predicate } from "@pokequery/core";
import {
  fetchFormats,
  fetchMoves,
  fetchAbilities,
  fetchQuery,
  type QueryRequest,
} from "./api.js";
import { FormatSelector } from "./components/FormatSelector.js";
import { PredicateBuilder } from "./components/PredicateBuilder.js";
import { ResultsTable } from "./components/ResultsTable.js";
import { decodeState, encodeState, isEmptyPredicate } from "./url-state.js";

const EXAMPLE: Predicate = {
  kind: "and",
  children: [
    { kind: "learnsMove", moveId: "trickroom" },
    {
      kind: "or",
      children: [
        { kind: "immuneToType", type: "Ground", allowAbilities: true },
        { kind: "partnerSpreadImmuneTo" },
      ],
    },
  ],
};

const EMPTY: Predicate = { kind: "and", children: [] };

const initialFromUrl = decodeState(typeof window !== "undefined" ? window.location.hash : "");

export default function App() {
  const [formatId, setFormatId] = useState<string | undefined>(initialFromUrl?.formatId);
  const [predicate, setPredicate] = useState<Predicate>(initialFromUrl?.predicate ?? EMPTY);
  const [submitted, setSubmitted] = useState<QueryRequest | null>(
    initialFromUrl && !isEmptyPredicate(initialFromUrl.predicate)
      ? { predicate: initialFromUrl.predicate, formatId: initialFromUrl.formatId, limit: 200 }
      : null,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const empty = isEmptyPredicate(predicate) && !formatId;
    const hash = empty ? "" : "#" + encodeState({ predicate, formatId });
    history.replaceState(null, "", hash || window.location.pathname + window.location.search);
  }, [predicate, formatId]);

  const { data: formats = [] } = useQuery({ queryKey: ["formats"], queryFn: fetchFormats });
  const { data: moves = [] } = useQuery({ queryKey: ["moves"], queryFn: fetchMoves });
  const { data: abilities = [] } = useQuery({ queryKey: ["abilities"], queryFn: fetchAbilities });

  const { data: results, isLoading, error } = useQuery({
    queryKey: ["query", submitted],
    queryFn: () => (submitted ? fetchQuery(submitted) : null),
    enabled: submitted !== null,
  });

  const handleSearch = () =>
    setSubmitted({ predicate, formatId, limit: 200 });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; ignore
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-indigo-700 tracking-tight">pokequery</h1>
        <FormatSelector formats={formats} value={formatId} onChange={setFormatId} />
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <PredicateBuilder
          predicate={predicate}
          onChange={setPredicate}
          moves={moves}
          abilities={abilities}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded"
            onClick={handleSearch}
          >
            Search
          </button>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-indigo-600"
            onClick={() => setPredicate(EXAMPLE)}
          >
            Example: learns TR &amp; immune to partner EQ
          </button>
          <button
            type="button"
            className="text-sm text-gray-400 hover:text-gray-600"
            onClick={() => { setPredicate(EMPTY); setSubmitted(null); }}
          >
            Clear
          </button>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-indigo-600 ml-auto"
            onClick={handleCopyLink}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        {isLoading && (
          <p className="text-sm text-gray-500 animate-pulse">Searching…</p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            {(error as Error).message}
          </div>
        )}

        {results && <ResultsTable data={results} predicate={submitted?.predicate} />}
      </main>
    </div>
  );
}
