import type { ContextKind } from "@/types/context";

import { KINDS, type KindInfo } from "./kinds";

const TAB = "inline-flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-xs font-semibold transition-colors";
const TAB_IDLE = "border-border bg-card text-muted-foreground hover:text-foreground";

/** The four kinds of context as tabs, each with how many entries it has. */
export default function KindTabs({
  kind,
  counts,
  onChange,
}: {
  kind: ContextKind;
  counts: Record<string, number>;
  onChange: (kind: ContextKind) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kind of context">
      {KINDS.map((k) => (
        <button
          key={k.value}
          type="button"
          role="tab"
          aria-selected={k.value === kind}
          onClick={() => onChange(k.value)}
          className={`${TAB} ${k.value === kind ? k.active : TAB_IDLE}`}
        >
          <KindIcon info={k} size="sm" />
          {k.label} <span className="tabular-nums opacity-70">{counts[k.value] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

const ICON_SIZES = {
  sm: ["h-6 w-6 rounded-md", "w-3.5 h-3.5"],
  md: ["h-7 w-7 shrink-0 rounded-lg", "w-4 h-4"],
  lg: ["h-8 w-8 shrink-0 rounded-lg", "w-4 h-4"],
} as const;

/** The kind's icon on its own colour. */
export function KindIcon({ info, size }: { info: KindInfo; size: keyof typeof ICON_SIZES }) {
  const [box, icon] = ICON_SIZES[size];
  return (
    <span className={`grid place-items-center ${box} ${info.tone}`}>
      <info.icon className={icon} />
    </span>
  );
}

/** What the open kind is for, and how the analysis uses it. */
export function KindHelp({ info }: { info: KindInfo }) {
  return (
    <p className="flex items-start gap-2.5 px-4 py-3 border-b border-border/60 bg-muted/20 text-xs text-muted-foreground">
      <KindIcon info={info} size="md" />
      <span>
        {info.help} The analysis gets only the entries that match the content's brand, audience and platforms, treats them
        as background (not instructions), and shows which ones it used.
      </span>
    </p>
  );
}
