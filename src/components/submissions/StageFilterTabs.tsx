const PILL = "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors";
const PILL_ON = "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900";
const PILL_OFF = "border-slate-300 bg-card text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300";
const COUNT = "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums";
const COUNT_ON = "bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900";
const COUNT_OFF = "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";

/**
 * The status tabs on the posts list, each with how many posts it holds. Clicking the active one (other than All)
 * turns it off again.
 */
export default function StageFilterTabs<S extends string>({
  filters,
  stage,
  counts,
  loading,
  onChange,
}: {
  filters: { value: S | ""; label: string }[];
  stage: S | "";
  counts: Record<string, number>;
  loading: boolean;
  onChange: (stage: S | "") => void;
}) {
  return (
    <div className="flex max-w-full flex-wrap gap-2" role="group" aria-label="Filter by status">
      {filters.map((f) => {
        const active = stage === f.value;
        return (
          <button
            key={f.value || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active && f.value ? "" : f.value)}
            className={`${PILL} ${active ? PILL_ON : PILL_OFF}`}
          >
            {f.label}
            <span className={`${COUNT} ${active ? COUNT_ON : COUNT_OFF}`}>{loading ? "–" : counts[f.value] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
