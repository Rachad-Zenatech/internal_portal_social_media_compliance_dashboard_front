import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCircle2, Eye, MessageSquareWarning, PencilLine, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { scriptDocService } from "@/services/scriptDocService";
import type { Capacity, DocDetail, DocReviewer, Vote } from "@/types/scriptDoc";

const VOTE_LABEL: Record<Vote, string> = { APPROVE: "Approved", CHANGES: "Wants changes", DONE: "Done" };

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

/** Who has checked in and who hasn't: shown in the dialogs and the review panel. */
export function CheckInList({ reviewers }: { reviewers: DocReviewer[] }) {
  const required = reviewers.filter((r) => r.capacity === "EDIT");
  return (
    <ul className="flex flex-col gap-1.5">
      {required.map((r) => (
        <li key={r.user_id} className="flex items-start gap-2 text-sm">
          <Dot color={r.color} className="mt-1.5" />
          <div className="min-w-0 flex-1">
            <span className="font-medium">{r.name}</span>
            {r.vote ? (
              <span
                className={cn(
                  "ml-2 text-xs",
                  r.vote === "CHANGES" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300",
                )}
              >
                {VOTE_LABEL[r.vote]}
              </span>
            ) : (
              <span className="ml-2 text-xs text-muted-foreground">still working</span>
            )}
            {r.note && <p className="mt-0.5 text-xs text-muted-foreground">{r.note}</p>}
          </div>
          {r.vote ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="h-4 w-4 rounded-full border" />}
        </li>
      ))}
      {reviewers.some((r) => r.capacity === "VIEW") && (
        <li className="text-xs text-muted-foreground">
          View only (notes, no edits): {reviewers.filter((r) => r.capacity === "VIEW").map((r) => r.name).join(", ")}
        </li>
      )}
    </ul>
  );
}

/** The creator picks who reviews. At least one reviewer is required; each can edit, or only view and add notes. */
export function SubmitDialog({
  doc,
  open,
  onOpenChange,
  busy,
  onSubmit,
  bulkCount,
}: {
  doc: DocDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  /** Sending several scripts of the document together: how many. */
  bulkCount?: number;
  onSubmit: (reviewers: { user_id: string; capacity: Capacity }[], note: string) => void;
}) {
  const { data: options = [], isLoading } = useQuery({
    queryKey: ["script-doc-reviewers", doc.id],
    queryFn: () => scriptDocService.reviewers(doc.id),
    enabled: open,
  });
  const [picked, setPicked] = useState<Record<string, Capacity>>({});
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) return;
    // The reviewers chosen in the details (or those it was sent to last time), who can then be set to view only.
    if (doc.reviewers.length) setPicked(Object.fromEntries(doc.reviewers.map((r) => [r.user_id, r.capacity])));
    else setPicked(Object.fromEntries((doc.details.reviewer_ids ?? []).map((id) => [id, "EDIT" as Capacity])));
  }, [open, doc.reviewers, doc.details.reviewer_ids]);

  const ids = Object.keys(picked);
  const canEditCount = ids.filter((i) => picked[i] === "EDIT").length;
  const problem = ids.length === 0 ? "Pick at least one reviewer." : canEditCount === 0 ? "At least one reviewer has to be able to edit." : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{bulkCount ? `Send ${bulkCount} script${bulkCount === 1 ? "" : "s"} for review` : `Send “${doc.title}” for review`}</DialogTitle>
          <DialogDescription>
            Reviewers open the script together and edit it live. Content reviewers can approve; suggesting reviewers edit but cannot approve;
            “view only” reviewers read it and add notes.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-auto rounded-md border">
          {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading reviewers…</p>}
          {options.map((o) => {
            const cap = picked[o.id];
            return (
              <div key={o.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(cap)}
                    onChange={(e) =>
                      setPicked((p) => {
                        const next = { ...p };
                        if (e.target.checked) next[o.id] = "EDIT";
                        else delete next[o.id];
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{o.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {o.kind === "SUGGESTER" ? "Suggesting reviewer" : o.is_super_admin ? "Super admin" : "Content reviewer"}
                    </span>
                  </span>
                </label>
                {cap && (
                  <div className="flex shrink-0 overflow-hidden rounded-md border text-xs">
                    {(["EDIT", "VIEW"] as Capacity[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPicked((p) => ({ ...p, [o.id]: c }))}
                        className={cn("flex items-center gap-1 px-2 py-1", cap === c ? "bg-blue-600 text-white" : "hover:bg-muted")}
                      >
                        {c === "EDIT" ? <PencilLine className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {c === "EDIT" ? "Edits" : "View only"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!isLoading && options.length === 0 && <p className="p-3 text-sm text-muted-foreground">There is nobody to send it to yet.</p>}
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for the reviewers (optional)" rows={2} />
        {problem && <p className="text-xs text-destructive">{problem}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={Boolean(problem) || busy}
            onClick={() => onSubmit(ids.map((user_id) => ({ user_id, capacity: picked[user_id] })), note)}
          >
            {bulkCount ? "Send all for review" : "Send for review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Shown to each reviewer when someone else changed the script: say when you've finished looking. */
export function CheckInDialog({
  doc,
  open,
  onOpenChange,
  changedBy,
  busy,
  onCheckIn,
}: {
  doc: DocDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changedBy: string | null;
  busy: boolean;
  onCheckIn: (vote: Vote, note: string) => void;
}) {
  const canApprove = doc.access.role === "REVIEWER" || doc.access.role === "MANAGER";
  const [vote, setVote] = useState<Vote>(canApprove ? "APPROVE" : "DONE");
  const [note, setNote] = useState("");
  const options: { v: Vote; label: string; hint: string; icon: React.ReactNode }[] = useMemo(
    () =>
      canApprove
        ? [
            { v: "APPROVE", label: "Approve", hint: "I'm happy with the script as it reads now.", icon: <Check className="h-4 w-4" /> },
            { v: "CHANGES", label: "Request changes", hint: "It needs more work before it can be approved.", icon: <MessageSquareWarning className="h-4 w-4" /> },
          ]
        : [{ v: "DONE", label: "I'm finished", hint: "My edits and notes are all in.", icon: <Check className="h-4 w-4" /> }],
    [canApprove],
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finished reviewing?</DialogTitle>
          <DialogDescription>
            {changedBy ? `${changedBy} just changed the script. ` : ""}
            Check in when you've finished your changes and looked at everyone else's. A new change by anyone clears the check-ins, so
            everyone looks again.
          </DialogDescription>
        </DialogHeader>
        <CheckInList reviewers={doc.reviewers} />
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setVote(o.v)}
              className={cn("flex items-start gap-2 rounded-md border p-2.5 text-left text-sm", vote === o.v ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "hover:bg-muted")}
            >
              <span className="mt-0.5">{o.icon}</span>
              <span>
                <span className="block font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={vote === "CHANGES" ? "What needs to change (required)" : "A note (optional)"} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep working
          </Button>
          <Button disabled={busy || (vote === "CHANGES" && !note.trim())} onClick={() => onCheckIn(vote, note)}>
            Check in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Everyone has checked in: where does the script go next? */
export function Level2Dialog({
  doc,
  open,
  onOpenChange,
  busy,
  onFinalize,
}: {
  doc: DocDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onFinalize: (route: "LEVEL2" | "CREATOR", note: string) => void;
}) {
  const [note, setNote] = useState("");
  const wantsChanges = doc.reviewers.some((r) => r.vote === "CHANGES");
  const hasApproval = doc.reviewers.some((r) => r.vote === "APPROVE");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Everyone has checked in</DialogTitle>
          <DialogDescription>
            {wantsChanges
              ? "At least one reviewer wants changes, so the script goes back to the creator."
              : "Pass it to the Content Manager for level 2 approval, or approve it now and return it to the creator."}
          </DialogDescription>
        </DialogHeader>
        <CheckInList reviewers={doc.reviewers} />
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="A note for the next person (optional)" />
        <DialogFooter className="gap-2 sm:flex-col sm:items-stretch">
          {wantsChanges ? (
            <Button disabled={busy} onClick={() => onFinalize("CREATOR", note)}>
              Send back to the creator
            </Button>
          ) : (
            <>
              <Button disabled={busy} onClick={() => onFinalize("LEVEL2", note)}>
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                Pass to Content Manager (level 2)
              </Button>
              {hasApproval && (
                <Button variant="outline" disabled={busy} onClick={() => onFinalize("CREATOR", note)}>
                  Approve and return to the creator
                </Button>
              )}
            </>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not yet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The Content Manager's final decision. */
export function DecisionDialog({
  doc,
  open,
  onOpenChange,
  busy,
  onDecide,
}: {
  doc: DocDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onDecide: (decision: "APPROVE" | "SEND_BACK", note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{doc.status === "LEVEL2_REVIEW" ? "Level 2 decision" : "Final decision"}</DialogTitle>
          <DialogDescription>Approving returns the script to the creator for the next steps; sending it back asks them for changes.</DialogDescription>
        </DialogHeader>
        <CheckInList reviewers={doc.reviewers} />
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="A note for the creator (required when sending back)" />
        <DialogFooter>
          <Button variant="outline" disabled={busy || !note.trim()} onClick={() => onDecide("SEND_BACK", note)}>
            Send back for changes
          </Button>
          <Button disabled={busy} onClick={() => onDecide("APPROVE", note)}>
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
