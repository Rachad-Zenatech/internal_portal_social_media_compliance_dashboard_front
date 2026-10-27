import { useState } from "react";
import { Link } from "react-router-dom";

import { Section } from "@/components/dashboard/dashboardParts";

export interface PipelineStage {
  key: string;
  label: string;
  /** Bar and legend colour; match the stage's status pill colour. */
  bar: string;
  /** Where clicking the stage goes. */
  to: string;
}

/** Posts by stage, as one bar; hovering a stage (bar or legend) picks it out, clicking opens it. */
export default function PipelineSection({
  stages,
  counts,
  total,
  loading,
  title = "Content Pipeline",
  subtitle,
}: {
  stages: PipelineStage[];
  counts: Record<string, number>;
  /** What the percentages are out of. */
  total: number;
  loading: boolean;
  title?: string;
  subtitle: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const current = stages.find((st) => st.key === active);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <Section title={title} subtitle={subtitle}>
      <div className="space-y-3 border-t border-border/60 px-4 py-4" onMouseLeave={() => setActive(null)}>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : total === 0 ? (
          <p className="text-xs text-muted-foreground">Your posts will show here once you create some.</p>
        ) : (
          <>
            {/* What the pointer is on, or the total when it's on nothing */}
            <p className="flex h-5 items-baseline gap-1.5 text-sm" aria-live="polite">
              {current ? (
                <>
                  <span className="font-semibold text-foreground">{current.label}</span>
                  <span className="text-muted-foreground">
                    {counts[current.key] ?? 0} post{(counts[current.key] ?? 0) === 1 ? "" : "s"} · {pct(counts[current.key] ?? 0)}%
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{total}</span>
                  <span className="text-muted-foreground">post{total === 1 ? "" : "s"} in total</span>
                </>
              )}
            </p>
            <div className="flex h-4 w-full items-center gap-0.5" aria-label="Posts by stage">
              {stages.filter((st) => counts[st.key]).map((st) => (
                <Link
                  key={st.key}
                  to={st.to}
                  aria-label={`${st.label}: ${counts[st.key]}`}
                  onMouseEnter={() => setActive(st.key)}
                  onFocus={() => setActive(st.key)}
                  onBlur={() => setActive(null)}
                  className={`${st.bar} block rounded-full transition-all duration-150 ${
                    active === st.key ? "h-4" : "h-3"
                  } ${active && active !== st.key ? "opacity-30" : "opacity-100"}`}
                  style={{ width: `${(counts[st.key] / total) * 100}%` }}
                />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
              {stages.map((st) => {
                const n = counts[st.key] ?? 0;
                return (
                  <li key={st.key}>
                    <Link
                      to={st.to}
                      onMouseEnter={() => setActive(st.key)}
                      onFocus={() => setActive(st.key)}
                      onBlur={() => setActive(null)}
                      className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 transition-colors ${
                        active === st.key ? "bg-muted" : ""
                      } ${active && active !== st.key ? "opacity-50" : ""}`}
                    >
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className={`h-2.5 w-2.5 rounded-sm ${st.bar}`} /> {st.label}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">{n}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Section>
  );
}
