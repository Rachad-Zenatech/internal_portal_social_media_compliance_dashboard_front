import type { Dispatch, SetStateAction } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import MultiSelectFilter from "@/components/ui/MultiSelectFilter";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";

export type DueFilter = "any" | "overdue" | "today" | "week" | "none";
export type CheckFilter = "any" | "failing" | "critical" | "passing";
export interface Filters {
  /** Brand codes and platforms to show; none picked means all. */
  brands: string[];
  platforms: string[];
  due: DueFilter;
  check: CheckFilter;
}
export const NO_FILTERS: Filters = { brands: [], platforms: [], due: "any", check: "any" };

export const DUE_LABELS: Record<DueFilter, string> = {
  any: "Any deadline",
  overdue: "Overdue",
  today: "Due today",
  week: "Due this week",
  none: "No deadline",
};
// The list is ordered by when each item was sent for review (deadlines have their own filter).
export type SortOrder = "newest" | "oldest";
export const SORT_LABELS: Record<SortOrder, string> = { newest: "Newest first", oldest: "Oldest first" };
export const CHECK_LABELS: Record<CheckFilter, string> = {
  any: "Any result",
  failing: "Failing (red or under 60)",
  critical: "Has a critical flag",
  passing: "Passing",
};

export const platformName = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;

/** How many of the four filters are in use (brand and platform count once each, however many values they hold). */
export const activeFilterCount = (f: Filters) =>
  [f.brands.length > 0, f.platforms.length > 0, f.due !== "any", f.check !== "any"].filter(Boolean).length;

type SetFilters = Dispatch<SetStateAction<Filters>>;
const TRIGGER = "h-8 w-full text-[13px]";

/** The Filters button and its popover: date order, brand, platform, deadline and check result. */
export function QueueFiltersButton({
  filters,
  setFilters,
  sort,
  setSort,
  brands,
  platforms,
  brandLabel,
  sentBack,
}: {
  filters: Filters;
  setFilters: SetFilters;
  sort: SortOrder;
  setSort: (s: SortOrder) => void;
  /** The brands and platforms in the queue, to pick from. */
  brands: string[];
  platforms: string[];
  brandLabel: (code: string) => string;
  /** On the Sent back tab the deadline is the creator's. */
  sentBack: boolean;
}) {
  const active = activeFilterCount(filters);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-8 gap-1.5 px-2.5 text-xs" aria-label="Filters">
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
          {active > 0 && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">{active}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3 p-3">
        <SelectField id="f-sort" label="Date sent" value={sort} onChange={(v) => setSort(v as SortOrder)} options={Object.entries(SORT_LABELS)} />
        <FilterField label="Brand">
          <MultiSelectFilter
            options={brands.map((b) => ({ value: b, label: brandLabel(b) }))}
            value={filters.brands}
            onChange={(next) => setFilters((f) => ({ ...f, brands: next }))}
            allLabel="All brands"
            noun="brand"
            ariaLabel="Brand"
            className={TRIGGER}
          />
        </FilterField>
        <FilterField label="Platform">
          <MultiSelectFilter
            options={platforms.map((p) => ({ value: p, label: platformName(p) }))}
            value={filters.platforms}
            onChange={(next) => setFilters((f) => ({ ...f, platforms: next }))}
            allLabel="All platforms"
            noun="platform"
            ariaLabel="Platform"
            className={TRIGGER}
          />
        </FilterField>
        <SelectField
          id="f-due"
          label={sentBack ? "Creator's deadline" : "Deadline"}
          value={filters.due}
          onChange={(v) => setFilters((f) => ({ ...f, due: v as DueFilter }))}
          options={Object.entries(DUE_LABELS)}
        />
        <SelectField
          id="f-check"
          label="Compliance check"
          value={filters.check}
          onChange={(v) => setFilters((f) => ({ ...f, check: v as CheckFilter }))}
          options={Object.entries(CHECK_LABELS)}
        />
        <Button variant="ghost" size="sm" className="h-8 self-end text-xs" onClick={() => setFilters(NO_FILTERS)} disabled={!active}>
          Clear filters
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function FilterField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <FilterField label={label} htmlFor={id}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} size="sm" className={TRIGGER}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, text]) => (
            <SelectItem key={v} value={v} className="text-[13px]">
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}

/** The filters in use, each as a chip that clears it. */
export function ActiveFilterChips({ filters, setFilters, brandLabel }: { filters: Filters; setFilters: SetFilters; brandLabel: (code: string) => string }) {
  if (activeFilterCount(filters) === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {filters.brands.map((b) => (
        <FilterChip key={`brand-${b}`} text={brandLabel(b)} onClear={() => setFilters((f) => ({ ...f, brands: f.brands.filter((x) => x !== b) }))} />
      ))}
      {filters.platforms.map((p) => (
        <FilterChip key={`platform-${p}`} text={platformName(p)} onClear={() => setFilters((f) => ({ ...f, platforms: f.platforms.filter((x) => x !== p) }))} />
      ))}
      {filters.due !== "any" && <FilterChip text={DUE_LABELS[filters.due]} onClear={() => setFilters((f) => ({ ...f, due: "any" }))} />}
      {filters.check !== "any" && <FilterChip text={CHECK_LABELS[filters.check]} onClear={() => setFilters((f) => ({ ...f, check: "any" }))} />}
    </div>
  );
}

function FilterChip({ text, onClear }: { text: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
      {text}
      <button type="button" onClick={onClear} aria-label={`Remove filter: ${text}`} className="text-muted-foreground hover:text-foreground">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
