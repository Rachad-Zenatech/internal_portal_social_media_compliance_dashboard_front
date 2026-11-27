import { Clock, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markerStyle, type TimelinePart } from "@/lib/videoCheckTimeline";

interface Props {
  parts: TimelinePart[];
  now: number;
  duration: number;
  playing: boolean;
  onToggle: () => void;
  onStep: (by: number) => void;
  seek: (time: number) => void;
}

const RISK = {
  GREEN: { label: "Clear", color: "bg-emerald-500", order: 0 },
  YELLOW: { label: "Needs review", color: "bg-amber-500", order: 1 },
  RED: { label: "Critical", color: "bg-red-600", order: 2 },
};
const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** Shared creator/reviewer timeline; observations and unchecked gaps stay distinct. */
export function FlaggedMoments(props: Props) {
  const duration = Number.isFinite(props.duration) && props.duration > 0 ? props.duration : 0;
  const now = Number.isFinite(props.now) ? Math.max(0, Math.min(props.now, duration)) : 0;
  return (
    <section aria-label="Video check timeline" className="min-w-0 space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold"><Clock className="size-3.5 text-muted-foreground" />Video check timeline</p>
      <TimelineLegend parts={props.parts} />
      <TimelineTrack parts={props.parts} now={now} duration={duration} seek={props.seek} />
      <PlaybackControls {...props} now={now} duration={duration} />
      <p className="text-[10px] leading-relaxed text-muted-foreground">Select a time to preview. Markers show checked moments; grey gaps are not marked clear.</p>
    </section>
  );
}

function TimelineLegend({ parts }: { parts: TimelinePart[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {(["RED", "YELLOW", "GREEN"] as const).map(risk => <LegendItem key={risk} risk={risk} count={parts.filter(part => part.risk === risk).length} />)}
    </div>
  );
}

function LegendItem({ risk, count }: { risk: TimelinePart["risk"]; count: number }) {
  const item = RISK[risk];
  return <span className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${item.color}`} aria-hidden="true" />{item.label} ({count})</span>;
}

function TimelineTrack({ parts, now, duration, seek }: Pick<Props, "parts" | "now" | "duration" | "seek">) {
  const visible = duration > 0 ? [...parts].sort((a, b) => RISK[a.risk].order - RISK[b.risk].order) : [];
  const progress = duration > 0 ? now / duration * 100 : 0;
  return (
    <div className="relative h-8 w-full min-w-0 select-none">
      <div data-testid="video-check-track" className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
        {visible.map((part, index) => <TimelineMarker key={index} part={part} duration={duration} />)}
      </div>
      <input type="range" min={0} max={duration || 1} step={0.01} value={now} disabled={!duration} onChange={event => seek(Number(event.target.value))} aria-label="Seek video" aria-valuetext={timeLabel(now)} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-default" />
      {duration > 0 && <span aria-hidden="true" style={{ left: `clamp(5px, ${progress}%, calc(100% - 5px))` }} className="pointer-events-none absolute top-1/2 z-20 h-5 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm ring-2 ring-background" />}
    </div>
  );
}

function TimelineMarker({ part, duration }: { part: TimelinePart; duration: number }) {
  const item = RISK[part.risk];
  const title = `${item.label}: ${timeLabel(part.start)}${part.end > part.start ? `–${timeLabel(part.end)}` : " (checked moment)"}`;
  return <span data-risk={part.risk} title={title} style={markerStyle(part, duration)} className={`absolute inset-y-0 rounded-full ${item.color}`} />;
}

function PlaybackControls({ now, duration, playing, onToggle, onStep }: Props) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="icon" variant="ghost" onClick={() => onStep(-1)} className="size-8 text-muted-foreground" title="Back 1 second"><SkipBack className="size-4" /></Button>
        <Button type="button" size="icon" onClick={onToggle} className="size-8 rounded-full" title={playing ? "Pause" : "Play"}>{playing ? <Pause className="size-3.5 fill-current" /> : <Play className="ml-0.5 size-3.5 fill-current" />}</Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => onStep(1)} className="size-8 text-muted-foreground" title="Forward 1 second"><SkipForward className="size-4" /></Button>
      </div>
      <span className="shrink-0 font-mono text-[11px] tabular-nums"><span className="font-semibold">{timeLabel(now)}</span><span className="text-muted-foreground"> / {timeLabel(duration)}</span></span>
    </div>
  );
}
