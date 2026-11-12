import { Loader2, ScrollText } from "lucide-react";

import type { ContextEntry, ContextKind } from "@/types/context";

import ContextEntryItem, { type EntryActions } from "./ContextEntryItem";
import type { KindInfo } from "./kinds";

interface Props extends EntryActions {
  loading: boolean;
  kind: ContextKind;
  info: KindInfo;
  needle: string;
  /** Every entry that matches (for the empty state); `items` is the page of them shown. */
  total: number;
  items: ContextEntry[];
}

/** The entries of the open kind: loading, an empty state that says what's missing, or the list. */
export default function ContextEntryList({ loading, kind, info, needle, total, items, ...actions }: Props) {
  if (loading) {
    return (
      <p className="p-6 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
      </p>
    );
  }
  if (total === 0) return <EmptyState kind={kind} info={info} needle={needle} />;
  return (
    <ul className="divide-y divide-border/60">
      {items.map((e) => (
        <ContextEntryItem key={e.id} entry={e} info={info} {...actions} />
      ))}
    </ul>
  );
}

function emptyHint(kind: ContextKind, needle: string) {
  if (kind === "BRAND_VOICE") return 'Until there is, the analysis rates brand fit as "no guidance".';
  if (kind === "FACT" && needle) return "Try another word.";
  if (kind === "FACT") {
    return "Without facts the analysis can't tell whether claims like product availability are plausible. Sync the newsroom to fill them in.";
  }
  return "Add one to give the analysis this background.";
}

function EmptyState({ kind, info, needle }: { kind: ContextKind; info: KindInfo; needle: string }) {
  const title = kind === "FACT" && needle ? "No facts match that search" : `No ${info.label.toLowerCase()} yet`;
  return (
    <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
      <span className={`mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl ${info.tone}`}>
        <ScrollText className="w-5 h-5" />
      </span>
      <p className="font-semibold text-foreground">{title}</p>
      <p>{emptyHint(kind, needle)}</p>
    </div>
  );
}
