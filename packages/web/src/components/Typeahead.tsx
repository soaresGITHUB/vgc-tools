import { useState } from "react";

interface Props {
  items: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export function Typeahead({ items, value, onChange, placeholder, className }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const selectedName = items.find((i) => i.id === value)?.name ?? "";
  const displayValue = focused ? query : selectedName;

  const filtered = focused
    ? (query.length > 0
        ? items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
        : items
      ).slice(0, 8)
    : [];

  function handleFocus() {
    setFocused(true);
    setQuery(selectedName);
  }

  function handleBlur() {
    setTimeout(() => {
      setFocused(false);
      setQuery("");
    }, 150);
  }

  function handleSelect(id: string) {
    onChange(id);
    setFocused(false);
    setQuery("");
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type="text"
        className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-indigo-400"
        placeholder={placeholder ?? "Search…"}
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filtered.length > 0 && (
        <ul className="absolute z-20 bg-white border border-gray-200 rounded shadow-lg w-full mt-0.5 max-h-48 overflow-y-auto">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 hover:text-indigo-700"
                onMouseDown={() => handleSelect(item.id)}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
