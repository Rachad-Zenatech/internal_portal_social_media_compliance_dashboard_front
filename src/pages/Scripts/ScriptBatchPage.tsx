import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, CheckCheck, CheckCircle2, Loader2, Plus, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import BatchDetailsForm from "@/components/script/BatchDetailsForm";
import BatchItemCard, { type Decision } from "@/components/script/BatchItemCard";
import { Button } from "@/components/ui/button";
import { useBatchActions, useReviewBatch, useScriptBatch } from "@/hooks/useScriptBatches";
import { useAuth } from "@/lib/AuthContext";
import { scriptBatchService } from "@/services/scriptBatchService";
import type { Batch, BatchDetails, BatchItem } from "@/types/scriptBatch";

/** What a reviewer can approve straight away: a score that reaches the minimum, no critical flag, and the AI read it. */
const MIN_SCORE = 70;
const looksApprovable = (item: BatchItem) => {
  const c = item.check;
  return Boolean(c) && !c!.ai_unavailable && c!.score >= MIN_SCORE && !(c!.violations ?? []).some((v) => v.traffic_light === "RED");
};

const DUE_CHOICES = [
  { value: "", label: "No deadline" },
  { value: "1", label: "1 working day" },
  { value: "2", label: "2 working days" },
  { value: "3", label: "3 working days" },
  { value: "5", label: "5 working days" },
];

function Banner({ tone, children }: { tone: "info" | "warn" | "ok"; children: React.ReactNode }) {
  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
    warn: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  };
  return <div role="status" className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

/**
 * A batch of scripts. The creator who uploaded it checks the split, sets the details every post will share and sends it;
 * a reviewer decides on all of its scripts on this one page. Each approved script becomes a post for the creator to film.
 */
export default function ScriptBatchPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: batch, isLoading, error } = useScriptBatch(id);

  if (isLoading) return <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Loading the scripts…</div>;
  if (error || !batch)
    return (
      <div className="mx-auto max-w-4xl space-y-3 p-6">
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "That batch couldn't be loaded."}</p>
        <Button variant="outline" onClick={() => navigate("/script-review")}>Back to script review</Button>
      </div>
    );
  return <BatchView batch={batch} />;
}

function BatchView({ batch }: { batch: Batch }) {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const actions = useBatchActions(batch.id);
  // Scripts being checked now; "Check all" checks two at a time.
  const [checkingIds, setCheckingIds] = useState<string[]>([]);
  const checkScripts = async (ids: string[]) => {
    setCheckingIds((prev) => [...new Set([...prev, ...ids])]);
    const queue = [...ids];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const done = next;
        try {
          await actions.checkItem.mutateAsync(done);
        } catch {
          // the hook already says what went wrong
        } finally {
          setCheckingIds((prev) => prev.filter((x) => x !== done));
        }
      }
    };
    await Promise.all([worker(), worker()]);
  };
  const review = useReviewBatch(batch.id);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [skipped, setSkipped] = useState<Record<string, string>>({});
  const [dueDays, setDueDays] = useState("");
  const [details, setDetails] = useState<BatchDetails | null>(null);

  const shown = details ?? batch.details;
  const waiting = batch.items.filter((i) => i.status === "IN_REVIEW");
  // Scripts not sent yet: the batch's own edit and send apply to these; a sent script is worked on its own page.
  const sendable = batch.items.filter((i) => i.status === "DRAFT");
  // Like a post: each script is checked (and fixed) before it's sent; a script changed since its check is checked again.
  const unchecked = sendable.filter((i) => !i.check || i.check_stale);
  const hasPosts = batch.items.some((i) => i.submission_id);
  // Scripts not sent yet whose own details are incomplete (batches with details per script).
  const unsentGaps = sendable.filter((i) => i.missing_details.length > 0);
  // Reviewers open a script in the Content screener; its creator opens it on the post's script page.
  const reviewerLinks = hasPermission("CONTENT_REVIEW_APPROVE") && batch.created_by !== user?.id;
  const scriptHref = (item: BatchItem) =>
    reviewerLinks ? `/script-review/scripts/${item.submission_id}` : `/submissions/${item.submission_id}/script`;
  const firstWaiting = waiting[0];
  const picked = Object.entries(decisions).filter(([itemId]) => waiting.some((w) => w.id === itemId));
  const approving = picked.filter(([, d]) => d.decision === "APPROVE").length;
  const sendingBack = picked.filter(([, d]) => d.decision === "SEND_BACK").length;
  const missingNotes = picked.some(([, d]) => d.decision === "SEND_BACK" && !d.note.trim());

  const changeDetails = (next: BatchDetails) => {
    setDetails(next);
    actions.saveDetails.mutate({ details: next }, { onSuccess: () => setDetails(null) });
  };

  const submit = () => {
    const body = picked.map(([item_id, d]) => ({ item_id, decision: d.decision, note: d.note.trim() || undefined }));
    review.mutate(
      { decisions: body, due_days: dueDays ? Number(dueDays) : undefined },
      {
        onSuccess: ({ results }) => {
          const made = results.filter((r) => r.outcome === "APPROVED").length;
          const back = results.filter((r) => r.outcome === "SENT_BACK").length;
          const stuck: Record<string, string> = {};
          results.filter((r) => !r.ok).forEach((r) => (stuck[r.item_id] = r.outcome));
          setSkipped(stuck);
          // What went through is no longer a pending choice; what didn't stays picked so it can be fixed and retried.
          setDecisions((prev) => Object.fromEntries(Object.entries(prev).filter(([itemId]) => stuck[itemId])));
          const parts = [made && `${made} approved`, back && `${back} sent back`].filter(Boolean);
          if (parts.length) toast.success(parts.join(", "));
          if (Object.keys(stuck).length) toast.error(`${Object.keys(stuck).length} couldn't be decided. See the notes on those scripts.`);
        },
      }
    );
  };

  const deleteBatch = async () => {
    if (!window.confirm("Delete this batch and its scripts?")) return;
    try {
      await scriptBatchService.remove(batch.id);
      navigate("/script-review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the batch");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] min-[112.5rem]:max-w-[2200px] space-y-5 pb-28">
      <div>
        <Link to="/script-review" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Script review
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{batch.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {batch.items.length} script{batch.items.length === 1 ? "" : "s"}
              {batch.created_by_name ? ` · uploaded by ${batch.created_by_name}` : ""}
              {batch.source_name ? ` · ${batch.source_name}` : ""}
              {batch.sent_at ? ` · sent ${format(new Date(batch.sent_at), "MMM d, h:mm a")}` : ""}
            </p>
          </div>
          {batch.can_edit && !hasPosts && (
            <Button type="button" variant="ghost" size="sm" onClick={deleteBatch} className="gap-1.5 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Delete batch
            </Button>
          )}
        </div>
      </div>

      {batch.status === "PROCESSING" && (
        <Banner tone="info">
          <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
          <span>Checking each script against the rulebook, then sending them to the reviewers. This takes a moment.</span>
        </Banner>
      )}
      {batch.error && <Banner tone="warn"><span>{batch.error}</span></Banner>}
      {batch.status === "IN_REVIEW" && !reviewerLinks && (
        <Banner tone="info"><span>Your scripts are with the reviewers. Each one is reviewed on its own page; you will be told when it is approved or needs changes.</span></Banner>
      )}
      {batch.status === "IN_REVIEW" && reviewerLinks && (
        <Banner tone="info">
          <span>
            Open a script to review it with its flags, comments and edits, and step to the next from there. Or decide on several below at once.
          </span>
        </Banner>
      )}
      {batch.status === "CHANGES_REQUESTED" && !reviewerLinks && (
        <Banner tone="warn"><span>Some scripts need your changes. Open each one to update it and send it back; approved scripts are already posts to film.</span></Banner>
      )}
      {batch.status === "DONE" && (
        <Banner tone="ok">
          <CheckCircle2 className="mt-0.5 h-4 w-4" />
          <span>
            Every script is approved, and each is its own post.{" "}
            {!reviewerLinks && (<><Link to="/submissions" className="font-medium underline">Open your posts</Link> to film and upload the videos.</>)}
          </span>
        </Banner>
      )}

      {batch.can_edit ? (
        <section aria-label="Details for the posts" className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Details for the posts</h2>
              <p className="text-xs text-muted-foreground">
                {batch.per_script_details
                  ? "Each script has its own details, set on its card below. Sending makes a post for each, checked against the rules for its own details."
                  : "Set once here. Sending makes a post for each script with these details, so each script is checked against the rules for them."}
              </p>
            </div>
            <div role="radiogroup" aria-label="How the details are set" className="grid grid-cols-2 rounded-lg bg-muted p-0.5 text-xs font-semibold">
              {([[false, "Same for every script"], [true, "Different for each script"]] as const).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={batch.per_script_details === value}
                  disabled={actions.saveDetails.isPending}
                  onClick={() => batch.per_script_details !== value && actions.saveDetails.mutate({ per_script_details: value })}
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    batch.per_script_details === value ? "bg-card text-blue-700 shadow-sm dark:text-blue-300" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {batch.per_script_details ? (
            <p className="text-xs text-muted-foreground">
              {unsentGaps.length === 0
                ? "Every script's details are complete."
                : `${unsentGaps.length} script${unsentGaps.length === 1 ? " needs its" : "s need their"} details: open Details on the card.`}{" "}
              Switching back to the same details for every script keeps the details you set here.
            </p>
          ) : (
            <BatchDetailsForm details={shown} missing={batch.missing_details} onChange={changeDetails} />
          )}
        </section>
      ) : (
        batch.details.platforms?.length ? (
          <p className="text-xs text-muted-foreground">
            For {(batch.details.brand_codes ?? []).join(", ") || "any brand"} on {(batch.details.platforms ?? []).join(", ")}
            {batch.details.approval_needed_by ? ` · approval needed by ${format(new Date(batch.details.approval_needed_by), "MMM d, h:mm a")}` : ""}
          </p>
        ) : null
      )}

      <section aria-label="Scripts" className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3 min-[112.5rem]:grid-cols-4">
        {batch.items.map((item) => (
          <BatchItemCard
            key={item.id}
            item={item}
            canEdit={batch.can_change_scripts}
            canReview={batch.can_review}
            perScript={batch.per_script_details}
            onSaveDetails={(d) => actions.updateItem.mutate({ itemId: item.id, details: d })}
            openHref={item.submission_id ? scriptHref(item) : undefined}
            openLabel={reviewerLinks ? (item.status === "IN_REVIEW" ? "Review script" : "Open script") : "Open script"}
            decision={decisions[item.id]}
            skippedReason={skipped[item.id]}
            saving={actions.updateItem.isPending}
            onDecide={(next) =>
              setDecisions((prev) => {
                const { [item.id]: _gone, ...rest } = prev;
                return next ? { ...rest, [item.id]: next } : rest;
              })
            }
            onSave={(data) => actions.updateItem.mutate({ itemId: item.id, ...data })}
            onRemove={() => actions.removeItem.mutate(item.id)}
            checking={checkingIds.includes(item.id)}
            onCheck={batch.can_change_scripts ? () => void checkScripts([item.id]) : undefined}
          />
        ))}
        {batch.can_change_scripts && (
          <Button
            type="button"
            variant="outline"
            onClick={() => actions.addItem.mutate({ title: `Script ${batch.items.length + 1}`, body: "" })}
            disabled={actions.addItem.isPending}
            className="col-span-full gap-1.5 justify-self-start"
          >
            <Plus className="h-4 w-4" /> Add a script
          </Button>
        )}
      </section>

      {batch.can_change_scripts && sendable.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] min-[112.5rem]:max-w-[2200px] flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {batch.missing_details.length
                ? `Still needed: ${batch.missing_details.join(", ")}`
                : unsentGaps.length
                  ? `Still needed: ${unsentGaps.slice(0, 3).map((i) => `${i.title} (${i.missing_details.join(", ")})`).join("; ")}${unsentGaps.length > 3 ? ` and ${unsentGaps.length - 3} more` : ""}`
                  : unchecked.length
                    ? `${unchecked.length} script${unchecked.length === 1 ? "" : "s"} to check before sending`
                    : `${sendable.length} script${sendable.length === 1 ? "" : "s"} checked and ready to send`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
            {unchecked.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void checkScripts(unchecked.map((i) => i.id))}
                disabled={checkingIds.length > 0}
                className="gap-2"
              >
                {checkingIds.length > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {checkingIds.length > 0 ? `Checking ${checkingIds.length}…` : unchecked.length === 1 ? "Check compliance" : `Check all ${unchecked.length}`}
              </Button>
            )}
            <Button
              type="button"
              onClick={() => actions.send.mutate()}
              disabled={!batch.can_send || actions.send.isPending || unchecked.length > 0}
              className="gap-2 bg-blue-700 text-white hover:bg-blue-800"
            >
              {actions.send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send for review
            </Button>
            </div>
          </div>
        </div>
      )}

      {batch.can_review && waiting.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] min-[112.5rem]:max-w-[2200px] flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {firstWaiting?.submission_id && (
                <Button asChild size="sm" className="gap-1.5 bg-blue-700 text-white hover:bg-blue-800">
                  <Link to={scriptHref(firstWaiting)}>
                    Review one by one <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  setDecisions((prev) => ({
                    ...prev,
                    ...Object.fromEntries(waiting.filter(looksApprovable).map((i) => [i.id, { decision: "APPROVE", note: "" } as Decision])),
                  }))
                }
              >
                <CheckCheck className="h-4 w-4" /> Approve all that pass ({waiting.filter(looksApprovable).length})
              </Button>
              {picked.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setDecisions({})}>Clear</Button>
              )}
              <label className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                Video due
                <select
                  value={dueDays}
                  onChange={(e) => setDueDays(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                  aria-label="When the videos are due"
                >
                  {DUE_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {picked.length === 0 ? `${waiting.length} waiting` : `${approving} to approve · ${sendingBack} to send back`}
              </span>
              <Button
                type="button"
                onClick={submit}
                disabled={picked.length === 0 || missingNotes || review.isPending}
                title={missingNotes ? "Say what needs to change on each script you send back" : undefined}
                className="gap-2 bg-blue-700 text-white hover:bg-blue-800"
              >
                {review.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit {picked.length || ""} decision{picked.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
