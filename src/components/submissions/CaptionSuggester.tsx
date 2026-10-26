import { useState } from "react";
import { AlertTriangle, Check, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCaptionSuggestions } from "@/hooks/useCaptionSuggestions";
import type { CaptionSuggestion } from "@/types/caption";

const SCORE_TONE: Record<string, string> = {
  GREEN: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  YELLOW: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  RED: "bg-red-500/10 text-red-700 dark:text-red-300",
};

function SuggestionCard({ s, onUse }: { s: CaptionSuggestion; onUse: () => void }) {
  return (
    <li className="rounded-lg border border-border/70 bg-background p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{s.style}</p>
        <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold tabular-nums ${SCORE_TONE[s.check.traffic_light] ?? SCORE_TONE.YELLOW}`}>
          {s.check.blocked ? "Blocked" : `Score ${s.check.score}`}
        </span>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{s.text}</p>
      {s.hashtags.length > 0 && <p className="text-blue-700 dark:text-blue-300">{s.hashtags.join(" ")}</p>}
      {s.check.flags.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
          <span>Flagged by the rulebook: {s.check.flags.join("; ")}. Edit it before sending.</span>
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tabular-nums text-muted-foreground">{s.characters.toLocaleString()} characters</span>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={onUse}>
          <Check className="w-3 h-3" /> Use this
        </Button>
      </div>
    </li>
  );
}

/**
 * "Suggest a caption": three captions drafted from the post itself (images, video transcript, title), in the
 * brand's voice and already run through the compliance check. Using one puts it in the editor to edit freely.
 */
export default function CaptionSuggester({
  submissionId,
  ensureSubmissionId,
  maxChars,
  hasCaption,
  onUse,
  onClose,
}: {
  submissionId: string | null;
  /** Saves the draft first if needed, so the server can see its files. */
  ensureSubmissionId: () => Promise<string | null>;
  maxChars: number;
  hasCaption: boolean;
  onUse: (caption: string) => void;
  onClose: () => void;
}) {
  const { suggest, usage } = useCaptionSuggestions(submissionId);
  const [hint, setHint] = useState("");
  const outOfRuns = usage?.remaining === 0;
  const result = suggest.data;

  const run = async () => {
    const id = await ensureSubmissionId();
    if (id) suggest.mutate({ id, hint, maxChars });
  };

  return (
    <div className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Sparkles className="w-4 h-4 text-violet-500" /> Suggest a caption
          </p>
          <p className="text-[11px] text-muted-foreground">
            Written from your post's images, video and title, in the brand's voice, and checked against the rulebook. Only
            says what the post shows, so add any facts it leaves out.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close caption suggestions">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !suggest.isPending && !outOfRuns && run()}
          placeholder="Optional: what should it focus on? e.g. mention the Ohio launch, keep it short"
          className="text-xs h-8"
          maxLength={500}
        />
        <Button size="sm" className="h-8 text-xs gap-1.5 shrink-0" disabled={suggest.isPending || outOfRuns} onClick={run}>
          {suggest.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {result ? "Suggest again" : "Suggest captions"}
        </Button>
      </div>
      {usage?.remaining != null && (
        <p className={`text-[10px] tabular-nums ${outOfRuns ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
          {outOfRuns ? "Daily limit for caption suggestions reached" : `${usage.remaining} suggestion runs left today`}
        </p>
      )}

      {suggest.isPending && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Watching your post and drafting captions. Videos can take up to a minute...
        </p>
      )}

      {result && !suggest.isPending && (
        <div className="space-y-2">
          {result.notes.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {result.notes.map((n, i) => (
                <li key={i}>· {n}</li>
              ))}
            </ul>
          )}
          <ul className="grid grid-cols-1 xl:grid-cols-3 gap-2">
            {result.suggestions.map((s, i) => (
              <SuggestionCard
                key={i}
                s={s}
                onUse={() => {
                  if (hasCaption && !window.confirm("Replace the caption you've written with this one?")) return;
                  onUse(s.hashtags.length ? `${s.text}\n\n${s.hashtags.join(" ")}` : s.text);
                }}
              />
            ))}
          </ul>
          {result.based_on.length > 0 && (
            <p className="text-[10px] text-muted-foreground">Based on {result.based_on.join(", ")}.</p>
          )}
        </div>
      )}
    </div>
  );
}
