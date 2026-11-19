import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ExternalLink, FileVideo, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import BatchDetailsForm from "@/components/script/BatchDetailsForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { scriptDocService } from "@/services/scriptDocService";
import type { BatchDetails } from "@/types/scriptBatch";
import type { DocDetail } from "@/types/scriptDoc";

const SAVE_DELAY_MS = 800;

/** Shared state and auto-save mutation for document details (used by both the creator accordion and reviewer dialog). */
function useDocDetails(doc: DocDetail, onDoc: (d: DocDetail) => void) {
  const editable = doc.access.can_submit;
  const [details, setDetails] = useState<BatchDetails>(doc.details ?? {});
  const [missing, setMissing] = useState<string[]>(doc.missing_details);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useMutation({
    mutationFn: (d: BatchDetails) => scriptDocService.update(doc.id, { details: d }),
    onSuccess: (d) => {
      setMissing(d.missing_details);
      onDoc(d);
    },
    onError: (e: unknown) => toast.error((e as { message?: string })?.message ?? "Couldn't save the details"),
  });

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const change = (next: BatchDetails) => {
    setDetails(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate(next), SAVE_DELAY_MS);
  };

  const makePosts = useMutation({
    mutationFn: () => scriptDocService.createPosts(doc.id),
    onSuccess: onDoc,
    onError: (e: unknown) => toast.error((e as { message?: string })?.message ?? "Couldn't make the post"),
  });

  return { editable, details, missing, saving: save.isPending, change, makePosts };
}

function DocDetailsStatusBadges({ editable, missingCount, saving }: { editable: boolean; missingCount: number; saving: boolean }) {
  return (
    <>
      {editable && missingCount > 0 && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
          {missingCount} to fill in
        </span>
      )}
      {editable && missingCount === 0 && <span className="text-xs font-normal text-emerald-700 dark:text-emerald-400">Ready to send</span>}
      {saving && <span className="text-xs font-normal text-muted-foreground">Saving…</span>}
    </>
  );
}

function DocDetailsBody({
  doc,
  editable,
  details,
  missing,
  onChange,
  makePosts,
}: {
  doc: DocDetail;
  editable: boolean;
  details: BatchDetails;
  missing: string[];
  onChange: (next: BatchDetails) => void;
  makePosts: { isPending: boolean; mutate: () => void };
}) {
  return (
    <>
      {doc.status === "APPROVED" && (
        <div className="rounded-lg border bg-card p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <FileVideo className="h-4 w-4" /> The post made from this script
          </p>
          {doc.posts.length === 0 && <p className="text-sm text-muted-foreground">No post has been made yet.</p>}
          <ul className="flex flex-col gap-1.5">
            {doc.posts.map((p) => (
              <li key={p.position} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {p.title}
                  {p.reference_code && <span className="ml-2 text-xs text-muted-foreground">{p.reference_code}</span>}
                </span>
                {doc.access.role === "CREATOR" && p.submission_id && (
                  <Link to={`/submissions/${p.submission_id}`} className="flex shrink-0 items-center gap-1 text-xs text-blue-700 hover:underline dark:text-blue-300">
                    Attach the video <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {doc.posts.length === 0 && doc.access.role === "CREATOR" && (
            <Button size="sm" className="mt-2" disabled={makePosts.isPending} onClick={() => makePosts.mutate()}>
              Make the post
            </Button>
          )}
        </div>
      )}

      <div className={cn(!editable && "pointer-events-none opacity-80")}>
        <BatchDetailsForm details={details} missing={editable ? missing : []} disabled={!editable} hideReviewers onChange={onChange} />
      </div>
    </>
  );
}

/** The button that opens or toggles the details, with how many are still to fill in. */
export function DocDetailsButton({ doc, onClick }: { doc: DocDetail; onClick: () => void }) {
  const todo = doc.access.can_submit ? doc.missing_details.length : 0;
  return (
    <Button size="sm" variant="outline" onClick={onClick} className="relative">
      <SlidersHorizontal className="mr-1.5 h-4 w-4" />
      Details
      {todo > 0 && (
        <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
          {todo} to fill in
        </span>
      )}
    </Button>
  );
}

/** Creator-side collapsible accordion at the top of the script page, expanded by default. */
export function DocDetailsAccordion({
  doc,
  open,
  onToggle,
  onDoc,
}: {
  doc: DocDetail;
  open: boolean;
  onToggle: () => void;
  onDoc: (d: DocDetail) => void;
}) {
  const { editable, details, missing, saving, change, makePosts } = useDocDetails(doc, onDoc);
  const scripts = Math.max(doc.pages.length, 1);

  return (
    <section className="border-b bg-muted/20">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium hover:bg-muted/40"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>Details for the posts</span>
        <DocDetailsStatusBadges editable={editable} missingCount={missing.length} saving={saving} />
        <span className="ml-auto hidden text-xs font-normal text-muted-foreground sm:inline">
          Shared by {scripts} script{scripts === 1 ? "" : "s"} · {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="max-h-[42vh] space-y-3 overflow-y-auto border-t bg-background/80 px-4 py-3">
          <DocDetailsBody doc={doc} editable={editable} details={details} missing={missing} onChange={change} makePosts={makePosts} />
        </div>
      )}
    </section>
  );
}

/**
 * The details every post made from this document shares (brand, audience, region, platforms, accounts, rule sets,
 * reviewers, and when approval is needed by). They open over the editor instead of taking its space, save as they are
 * changed, and apply to every script in the document that hasn't been sent yet.
 */
export default function DocDetailsDialog({
  doc,
  open,
  onOpenChange,
  onDoc,
}: {
  doc: DocDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDoc: (d: DocDetail) => void;
}) {
  const { editable, details, missing, saving, change, makePosts } = useDocDetails(doc, onDoc);
  const scripts = Math.max(doc.pages.length, 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Details for the posts
            <DocDetailsStatusBadges editable={editable} missingCount={missing.length} saving={saving} />
          </DialogTitle>
          <DialogDescription>
            Shared by the {scripts} script{scripts === 1 ? "" : "s"} in this document. Each approved script becomes a post with these
            details. You pick the reviewers when you send it.{!editable && " They can't be changed after the script has been sent for review."}
          </DialogDescription>
        </DialogHeader>
        <DocDetailsBody doc={doc} editable={editable} details={details} missing={missing} onChange={change} makePosts={makePosts} />
      </DialogContent>
    </Dialog>
  );
}
