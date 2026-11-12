import { useEffect, useState } from "react";
import { Clock, Layers, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReplyingTo, commentBoxId, formatSec } from "@/components/submissions/ReviewCommentsPanel";
import { useCommentReply, useReviewComments } from "@/hooks/useReview";
import type { ReviewCommentCategory, ReviewQueueItem } from "@/types/submission";

const CATEGORY_NAMES: Record<string, string> = {
  NOTE: "General note",
  LEGAL: "Legal",
  EDITORIAL: "Editorial",
  COMPLIANCE: "Compliance",
  BRAND: "Brand",
};

/** "1:05", "65" or "0:65" as seconds; null when it isn't a time. */
function parseTime(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length > 2 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(parts[0]);
}

/** One end of a video range: a time to type (m:ss), or "Now" for where the video is. */
function TimeField({ label, value, now, onChange }: { label: string; value: number; now: number; onChange: (sec: number) => void }) {
  const [text, setText] = useState(formatSec(value));
  // Follows the value when it changes from outside (the other end, or "Now").
  useEffect(() => setText(formatSec(value)), [value]);
  const commit = () => {
    const t = parseTime(text);
    if (t == null) setText(formatSec(value));
    else onChange(t);
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-semibold text-foreground">{label}</span>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        inputMode="numeric"
        aria-label={`${label} time`}
        className="h-7 w-16 px-2 text-center text-xs tabular-nums"
      />
      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onChange(Math.floor(now))} title={`Use ${formatSec(now)}, where the video is`}>
        Now
      </Button>
    </span>
  );
}

type Mode = "POINT" | "RANGE" | "NONE";
type Range = { start: number; end: number };

/** Pin the comment to the moment the video is at, to a stretch of it, or to no time. */
function TimeModePicker({ mode, now, range, onMode, onRange }: { mode: Mode; now: number; range: Range; onMode: (m: Mode) => void; onRange: (r: Range) => void }) {
  const seg = (on: boolean) =>
    `flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`;
  return (
    <div className="flex flex-wrap items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 text-[11px] font-semibold">
      <button type="button" onClick={() => onMode("POINT")} className={seg(mode === "POINT")}>
        <Clock className="w-3 h-3" /> Point ({formatSec(now)})
      </button>
      <button
        type="button"
        onClick={() => {
          onMode("RANGE");
          onRange({ start: Math.floor(now), end: Math.floor(now) + 5 });
        }}
        className={seg(mode === "RANGE")}
      >
        <Layers className="w-3 h-3" /> Range ({formatSec(range.start)} - {formatSec(range.end)})
      </button>
      <button type="button" onClick={() => onMode("NONE")} className={seg(mode === "NONE")}>
        No time
      </button>
    </div>
  );
}

/** The two ends of a range comment, each typed in or taken from where the video is. */
function RangeFields({ range, now, onRange }: { range: Range; now: number; onRange: (update: (r: Range) => Range) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
      <TimeField
        label="From"
        value={range.start}
        now={now}
        // A start past the end pushes the end along, so the range is never empty.
        onChange={(t) => onRange((r) => ({ start: t, end: r.end > t ? r.end : t + 1 }))}
      />
      <TimeField
        label="To"
        value={range.end}
        now={now}
        // An end before the start moves the start back.
        onChange={(t) => onRange((r) => (t > r.start ? { start: r.start, end: t } : { start: Math.max(0, t - 1), end: Math.max(t, 1) }))}
      />
      <span className="text-muted-foreground">Type a time (e.g. 1:05), or play to the moment and click "Now".</span>
    </div>
  );
}

/** Write a reviewer comment, pinned to a moment, a range of the video, or no time. */
export default function CommentComposer({ s, now, hasVideo }: { s: ReviewQueueItem; now: number; hasVideo: boolean }) {
  const { add } = useReviewComments(s.id);
  // Set by Reply under a comment in the list below; the reply quotes that comment.
  const { replyTo, setReplyTo } = useCommentReply(s.id);
  const [category, setCategory] = useState<ReviewCommentCategory>("NOTE");
  const [mode, setMode] = useState<Mode>(hasVideo ? "POINT" : "NONE");
  const [range, setRange] = useState<Range>({ start: 0, end: 5 });
  const [body, setBody] = useState("");

  const post = () => {
    if (!body.trim()) return;
    const at = (t: number) => Math.round(t * 10) / 10;
    const times =
      !hasVideo || mode === "NONE"
        ? { start_sec: null, end_sec: null }
        : mode === "POINT"
        ? { start_sec: at(now), end_sec: null }
        : { start_sec: at(range.start), end_sec: at(Math.max(range.end, range.start + 1)) };
    add.mutate(
      { body: body.trim(), category, ...times, reply_to_id: replyTo?.id ?? null },
      {
        onSuccess: () => {
          setBody("");
          setReplyTo(null);
        },
      }
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        post();
      }}
      className="flex flex-col gap-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={(v) => setCategory(v as ReviewCommentCategory)}>
          <SelectTrigger size="sm" className="h-8 w-[150px] text-xs font-semibold" aria-label="Comment type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_NAMES).map(([value, label]) => (
              <SelectItem key={value} value={value} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasVideo && (
          <TimeModePicker
            mode={mode}
            now={now}
            range={range}
            onMode={setMode}
            onRange={setRange}
          />
        )}
      </div>
      {hasVideo && mode === "RANGE" && <RangeFields range={range} now={now} onRange={setRange} />}
      {replyTo && <ReplyingTo c={replyTo} onCancel={() => setReplyTo(null)} />}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id={commentBoxId(s.id)}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && replyTo) setReplyTo(null);
          }}
          placeholder={
            !hasVideo || mode === "NONE"
              ? "Suggest a change or leave a note..."
              : mode === "POINT"
              ? `Add a reviewer note at ${formatSec(now)}... (e.g. adjust the disclaimer or cut)`
              : `Add a reviewer note for ${formatSec(range.start)} - ${formatSec(range.end)}... (e.g. cut this section)`
          }
          aria-label="Reviewer note"
          autoFocus
          className="h-9 min-w-0 flex-1 text-sm"
        />
        <Button type="submit" className="h-9 shrink-0 gap-1.5 px-4 text-xs font-semibold" disabled={!body.trim() || add.isPending}>
          {add.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Post comment
        </Button>
      </div>
    </form>
  );
}
