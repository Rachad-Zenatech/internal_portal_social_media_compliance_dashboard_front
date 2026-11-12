import type { ReactNode } from "react";

/** The row of status pills above a list, each with its count; click the chosen one again to clear it. */
export default function StageTabs<T extends string>({
  filters,
  stage,
  onStage,
  counts,
  loading,
}: {
  filters: readonly { value: T; label: ReactNode }[];
  stage: T;
  onStage: (value: T) => void;
  counts: Partial<Record<string, number>>;
  loading: boolean;
}) {
  return (
    <div className="flex max-w-full flex-wrap gap-2" role="group" aria-label="Filter by status">
      {filters.map((f) => {
        const active = stage === f.value;
        const count = counts[f.value] ?? 0;
        return (
          <button
            key={f.value || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onStage(active && f.value ? ("" as T) : f.value)}
            className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
              active
                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-300 bg-card text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300"
            }`}
          >
            {f.label}
            <span
              className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                active ? "bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              }`}
            >
              {loading ? "–" : count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
