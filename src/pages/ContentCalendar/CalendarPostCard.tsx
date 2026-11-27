import { format } from "date-fns";
import PlatformIcon, { type SocialPlatform } from "@/components/video/PlatformIcon";
import DemoPoster from "@/components/video/DemoPoster";
import { CoverThumb } from "@/components/submissions/PostPreview";
import type { CalendarItem } from "@/types/calendar";
import { STATE, platformName, scoreTone, type SproutState } from "./calendarPresentation";

export function Thumb({ item, className = "" }: { item: CalendarItem; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-muted ${className}`}>
      {item.primary_file ? (
        <CoverThumb cover={item.primary_file} contentType={item.content_type} caption={item.caption} showPlay={false} />
      ) : (
        <DemoPoster variant={item.poster_variant ?? "dusk"} className="h-full w-full" />
      )}
    </div>
  );
}

export function Networks({ platforms, size = "w-3.5 h-3.5" }: { platforms: string[]; size?: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {platforms.map((p) => (
        <span key={p} className="grid h-5 w-5 place-items-center rounded border border-border/70 bg-background" title={platformName(p)}>
          <PlatformIcon platform={p as SocialPlatform} className={size} />
        </span>
      ))}
    </span>
  );
}

/** One post in a day column, Sprout-calendar style: time and status, networks, caption, picture. */
export function PostCard({ item, state, selected, onSelect }: { item: CalendarItem; state: SproutState; selected: boolean; onSelect: () => void }) {
  const st = STATE[state];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full flex-col gap-1.5 rounded-lg border bg-card p-2 text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        selected ? "border-blue-600 ring-2 ring-blue-600/20" : "border-border/70"
      }`}
    >
      <span className="flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span className={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden />
          {format(new Date(item.scheduled_for), "h:mm a")}
        </span>
        {item.score != null && <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${scoreTone(item.score)}`}>{item.score}</span>}
      </span>
      <Networks platforms={item.platforms} size="w-3 h-3" />
      <span className="line-clamp-2 text-xs leading-snug text-foreground/90">{item.caption || item.title}</span>
      <Thumb item={item} className="aspect-video w-full" />
      <span className={`text-[11px] font-medium ${st.text}`}>{st.label}</span>
    </button>
  );
}

export function CalendarSummaryPost({ item, state, selected, compact, onSelect }: {
  item: CalendarItem; state: SproutState; selected: boolean; compact: boolean; onSelect: () => void;
}) {
  const st = STATE[state];
  const time = format(new Date(item.scheduled_for), "h:mm a");
  const selection = selected ? "border-blue-600 bg-blue-50/60 dark:bg-blue-500/10" : "border-border/70 bg-card hover:bg-muted/40";
  if (compact) return (
    <button type="button" onClick={onSelect} aria-pressed={selected} title={`${item.title} · ${st.label}`} className={`flex w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] ${selection}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} aria-hidden />
      <span className="shrink-0 tabular-nums text-muted-foreground">{time}</span>
      <span className="truncate font-medium text-foreground">{item.title}</span>
    </button>
  );
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${selection}`}>
      <span className="w-16 shrink-0 text-xs font-semibold tabular-nums">{time}</span>
      <Thumb item={item} className="aspect-video w-16 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.caption}</span>
      </span>
      <Networks platforms={item.platforms} />
      {item.score != null && <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${scoreTone(item.score)}`}>{item.score}</span>}
      <span className={`hidden w-44 shrink-0 text-xs font-medium sm:block ${st.text}`}>{st.label}</span>
    </button>
  );
}
