import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The fields of a post's details, shared by the new-submission form and the script batch form so both look and work
 * the same: a bold label (with * when required) and a red line under it when something is wrong.
 */
export function Field({ label, required, error, children, className = "" }: { label: string; required?: boolean; error?: string | false; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 min-w-0 ${className}`}>
      <Label className="text-[13px] font-semibold text-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** Select-style box that holds removable chips; options open in a popover. */
export function MultiSelect<T extends string>({
  options,
  value,
  onChange,
  placeholder,
  renderIcon,
  getLabel = (v) => v,
  invalid,
  compact,
  searchable,
  getSearchText,
  selectAll,
}: {
  options: T[];
  value: T[];
  onChange: (next: T[]) => void;
  placeholder: string;
  renderIcon?: (v: T) => ReactNode;
  getLabel?: (v: T) => string;
  invalid?: boolean;
  compact?: boolean;
  /** A search box over the options, for long lists; it matches the label and getSearchText (e.g. an email). */
  searchable?: boolean;
  getSearchText?: (v: T) => string;
  /** A "Select all" row that picks (or clears) every option the search shows. */
  selectAll?: boolean;
}) {
  const [query, setQuery] = useState("");
  const toggle = (opt: T) => onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  const term = query.trim().toLowerCase();
  const shown = term
    ? options.filter((o) => `${getLabel(o)} ${getSearchText?.(o) ?? ""}`.toLowerCase().includes(term))
    : options;
  const allShownPicked = shown.length > 0 && shown.every((o) => value.includes(o));
  const toggleAll = () =>
    onChange(allShownPicked ? value.filter((v) => !shown.includes(v)) : [...value, ...shown.filter((o) => !value.includes(o))]);
  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className={`min-h-11 w-full flex items-center gap-1.5 rounded-xl border bg-background px-3 py-1.5 text-left cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
            invalid ? "border-red-500" : "border-input"
          }`}
        >
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {value.length === 0 && <span className="text-sm text-muted-foreground px-1">{placeholder}</span>}
            {value.map((v) => (
              <span
                key={v}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium ${
                  compact
                    ? "text-[11px] border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "text-xs border-border bg-muted/60 text-foreground"
                }`}
              >
                {renderIcon?.(v)}
                {getLabel(v)}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${getLabel(v)}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-1">
        {searchable && (
          <div className="relative mb-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="h-8 pl-7 text-sm"
              aria-label="Search options"
            />
          </div>
        )}
        {selectAll && shown.length > 1 && (
          <button
            type="button"
            onClick={toggleAll}
            className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium hover:bg-muted text-left border-b border-border mb-1"
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                allShownPicked ? "bg-blue-600 border-blue-600 text-white" : "border-input"
              }`}
            >
              {allShownPicked && <Check className="w-3 h-3" />}
            </span>
            {allShownPicked ? "Clear all" : term ? `Select all ${shown.length} shown` : "Select all"}
          </button>
        )}
        <div className={searchable ? "max-h-64 overflow-y-auto" : undefined}>
          {shown.map((opt) => {
            const checked = value.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted text-left"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    checked ? "bg-blue-600 border-blue-600 text-white" : "border-input"
                  }`}
                >
                  {checked && <Check className="w-3 h-3" />}
                </span>
                {renderIcon?.(opt)}
                {getLabel(opt)}
              </button>
            );
          })}
          {shown.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
