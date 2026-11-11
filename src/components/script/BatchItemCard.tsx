import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, ExternalLink, Trash2, Undo2 } from "lucide-react";

import RuleNumberBadge from "@/components/submissions/RuleNumberBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BatchItem, BatchItemStatus } from "@/types/scriptBatch";

export interface Decision {
  decision: "APPROVE" | "SEND_BACK";
  note: string;
}

const STATUS: Record<BatchItemStatus, { label: string; tone: string }> = {
  DRAFT: { label: "Not sent yet", tone: "bg-muted text-muted-foreground" },
  IN_REVIEW: { label: "With the reviewer", tone: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  APPROVED: { label: "Approved", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

/** The state of a script's check as a short chip: its score, or why it has none. */
function CheckChip({ item }: { item: BatchItem }) {
  const check = item.check;
  if (!check) return <span className="text-xs text-muted-foreground">Checked when sent</span>;
  if (check.ai_unavailable)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
        <Clock className="h-3.5 w-3.5" /> No score yet (the AI review couldn&apos;t run)
      </span>
    );
  const score = check.score;
  const flags = check.violations?.length ?? 0;
  const tone = score >= 80 ? "text-emerald-700 dark:text-emerald-400" : score >= 70 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", tone)}>
      {score >= 70 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {score}/100 · {flags} flag{flags === 1 ? "" : "s"}
    </span>
  );
}

/**
 * One script of a batch. The creator edits its title and wording while it is theirs to change; the reviewer sees its
 * compliance flags and decides on it (approve, or send back with a note) along with the others.
 */
export default function BatchItemCard({
  item,
  canEdit,
  canReview,
  decision,
  skippedReason,
  onDecide,
  onSave,
  onRemove,
  saving,
}: {
  item: BatchItem;
  /** The creator may change this script. */
  canEdit: boolean;
  /** A reviewer may decide on this script (it is with them). */
  canReview: boolean;
  decision?: Decision;
  /** Why the last attempt to approve this script didn't go through. */
  skippedReason?: string;
  onDecide: (next: Decision | undefined) => void;
  onSave: (data: { title?: string; body?: string }) => void;
  onRemove: () => void;
  saving?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  useEffect(() => {
    setTitle(item.title);
    setBody(item.body);
  }, [item.title, item.body]);
  const dirty = title.trim() !== item.title || body !== item.body;
  const editable = canEdit && (item.status === "DRAFT" || item.status === "CHANGES_REQUESTED");
  const status = STATUS[item.status];
  const flags = item.check?.violations ?? [];

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm",
        decision?.decision === "APPROVE" && "border-emerald-300 dark:border-emerald-500/40",
        decision?.decision === "SEND_BACK" && "border-amber-300 dark:border-amber-500/40"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">#{item.position}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.tone)}>{status.label}</span>
            <CheckChip item={item} />
          </div>
          {editable ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Script title" className="mt-2 font-medium" />
          ) : (
            <h3 className="mt-1.5 text-base font-semibold text-foreground">{item.title}</h3>
          )}
        </div>
        {item.status === "APPROVED" && item.submission_id && (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to={`/submissions/${item.submission_id}`}>
              {item.reference_code ?? "Open the post"} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
        {editable && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove ${item.title}`} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {item.status === "CHANGES_REQUESTED" && item.review_note && (
        <p className="mt-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="font-semibold">{item.reviewed_by_name ?? "The reviewer"}:</span> {item.review_note}
        </p>
      )}

      {editable ? (
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          aria-label={`Script ${item.position}`}
          className="mt-3 font-mono text-[13px]"
        />
      ) : (
        <div className="mt-3">
          <p className={cn("whitespace-pre-wrap text-sm text-foreground/90", !open && "line-clamp-4")}>{item.body}</p>
          {item.body.split("\n").length > 4 || item.body.length > 280 ? (
            <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
              {open ? <>Show less <ChevronUp className="h-3.5 w-3.5" /></> : <>Read all <ChevronDown className="h-3.5 w-3.5" /></>}
            </button>
          ) : null}
        </div>
      )}

      {editable && dirty && (
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" size="sm" disabled={saving || !title.trim()} onClick={() => onSave({ title: title.trim(), body })} className="bg-blue-700 text-white hover:bg-blue-800">
            Save changes
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setTitle(item.title); setBody(item.body); }}>
            Discard
          </Button>
        </div>
      )}

      {flags.length > 0 && item.status !== "APPROVED" && (
        <ul className="mt-3 space-y-1.5">
          {flags.slice(0, open ? flags.length : 3).map((v) => (
            <li key={`${v.rule_id}-${v.flagged_terms.join("|")}`} className="flex flex-wrap items-start gap-2 text-xs">
              <RuleNumberBadge v={v} />
              <span className={cn("font-medium", v.traffic_light === "RED" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>{v.title}</span>
              <span className="text-muted-foreground">&ldquo;{v.flagged_terms.slice(0, 3).join(", ")}&rdquo;</span>
            </li>
          ))}
          {flags.length > 3 && !open && (
            <li>
              <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400">
                Show all {flags.length} flags
              </button>
            </li>
          )}
        </ul>
      )}

      {skippedReason && (
        <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Not approved: {skippedReason}
        </p>
      )}

      {canReview && item.status === "IN_REVIEW" && (
        <div className="mt-4 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={decision?.decision === "APPROVE" ? "default" : "outline"}
              onClick={() => onDecide(decision?.decision === "APPROVE" ? undefined : { decision: "APPROVE", note: "" })}
              className={cn("gap-1.5", decision?.decision === "APPROVE" && "bg-emerald-600 text-white hover:bg-emerald-700")}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant={decision?.decision === "SEND_BACK" ? "default" : "outline"}
              onClick={() => onDecide(decision?.decision === "SEND_BACK" ? undefined : { decision: "SEND_BACK", note: decision?.note ?? "" })}
              className={cn("gap-1.5", decision?.decision === "SEND_BACK" && "bg-amber-600 text-white hover:bg-amber-700")}
            >
              <Undo2 className="h-4 w-4" /> Send back
            </Button>
          </div>
          {decision?.decision === "SEND_BACK" && (
            <Textarea
              value={decision.note}
              onChange={(e) => onDecide({ decision: "SEND_BACK", note: e.target.value })}
              rows={2}
              placeholder="What needs to change?"
              aria-label={`Note for ${item.title}`}
              className="mt-2"
            />
          )}
        </div>
      )}
    </article>
  );
}
