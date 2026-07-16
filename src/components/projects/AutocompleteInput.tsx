"use client";

import { useEffect, useId, useRef, useState } from "react";

export type AutocompleteOption<T> = {
  id: string;
  label: string;
  data: T;
};

type AutocompleteInputProps<T> = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: AutocompleteOption<T>) => void;
  options: AutocompleteOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onBlur?: () => void;
};

export function AutocompleteInput<T>({
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  disabled,
  className,
  onBlur,
}: AutocompleteInputProps<T>) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(value.trim().toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        className={className}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        list={listId}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        autoComplete="off"
      />
      {open && value.trim() && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.slice(0, 8).map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
