import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * A filter that takes several values at once: a dropdown of checkboxes. Nothing ticked means "all". The button says
 * what's picked ("LinkedIn", then "3 platforms"), and the list has Select all / Clear (and a search when it's long).
 */
export default function MultiSelectFilter({
  options,
  value,
  onChange,
  allLabel,
  noun,
  ariaLabel,
  className,
  align = "start",
}: {
  options: FilterOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /** What the button says with nothing picked, e.g. "All platforms". */
  allLabel: string;
  /** Singular noun for the count, e.g. "platform" gives "3 platforms". */
  noun: string;
  ariaLabel?: string;
  /** Classes for the button (height, width, background). */
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const toggle = (v: string, on: boolean) => onChange(on ? [...value, v] : value.filter((x) => x !== v));
  const text =
    value.length === 0 ? allLabel : value.length === 1 ? options.find((o) => o.value === value[0])?.label ?? value[0] : `${value.length} ${noun}s`;

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? allLabel}
          className={cn(
            "flex h-9 min-w-0 items-center justify-between gap-2 rounded-lg border bg-card px-2.5 text-xs outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50",
            value.length > 0 ? "border-blue-500/60 font-semibold text-blue-700 dark:text-blue-300" : "border-input text-foreground",
            className
          )}
        >
          <span className="truncate">{text}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-60 gap-0 p-0">
        {options.length > 8 && (
          <div className="relative border-b border-border/70 p-2">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search the list" className="h-8 pl-7 text-xs" />
          </div>
        )}
        <ul className="max-h-64 overflow-y-auto py-1" role="listbox" aria-multiselectable="true" aria-label={ariaLabel ?? allLabel}>
          {shown.length === 0 && <li className="px-3 py-3 text-center text-xs text-muted-foreground">Nothing matches</li>}
          {shown.map((o) => (
            <li key={o.value} role="option" aria-selected={selected.has(o.value)}>
              <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-muted/60">
                <Checkbox checked={selected.has(o.value)} onCheckedChange={(on) => toggle(o.value, on === true)} />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-border/70 px-2 py-1.5">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange(options.map((o) => o.value))} disabled={value.length === options.length}>
            Select all
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange([])} disabled={value.length === 0}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
