import type { FormatInfo } from "../api.js";

interface Props {
  formats: FormatInfo[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}

export function FormatSelector({ formats, value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-600">Format</label>
      <select
        className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">Any format</option>
        {formats.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </div>
  );
}
