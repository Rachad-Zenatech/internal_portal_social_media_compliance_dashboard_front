import type { ProcessStep } from "@/types/publicMood";

const DOT: Record<ProcessStep["status"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  none: "bg-slate-400",
  info: "bg-sky-500",
};

/** How this post's public mood was made, step by step (what was read, searched, found, matched and scored). */
export function ProcessLog({ steps }: { steps?: ProcessStep[] | null }) {
  if (!steps || steps.length === 0) return null;
  return (
    <details className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs">
      <summary className="cursor-pointer select-none font-semibold text-foreground">
        How this was made (process log)
      </summary>
      <ol className="mt-2 space-y-2.5">
        {steps.map((s) => (
          <li key={s.title} className="flex gap-2">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[s.status]}`} />
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {s.title} <span className="font-normal text-muted-foreground">· {s.summary}</span>
              </p>
              {s.lines.length > 0 && (
                <ul className="mt-0.5 space-y-0.5 text-[11px] text-muted-foreground">
                  {s.lines.map((l, i) => (
                    <li key={i} className="break-words">{l}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
