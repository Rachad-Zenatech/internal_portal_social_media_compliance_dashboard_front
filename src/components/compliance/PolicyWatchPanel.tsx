import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Check, ChevronDown, ExternalLink, Eye, EyeOff, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { contextService } from "@/services/contextService";
import type { PolicyProposal, PolicyWatch } from "@/types/context";

const KEY = ["messaging-context", "policy-watch"];

function Field({ label, current, value, onChange, rows }: {
  label: string;
  current?: string | null;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}: now</p>
        <p className="min-h-[2.5rem] whitespace-pre-wrap rounded-md border border-border/60 bg-muted/40 p-2 text-[11px] text-muted-foreground">
          {current || "—"}
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">{label}: proposed (you can edit it)</p>
        <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="text-[11px]" />
      </div>
    </div>
  );
}

/** One drafted update: what changed, the norm now beside the proposed wording, and approve or reject. */
function ProposalCard({ p, onDone }: { p: PolicyProposal; onDone: (w: PolicyWatch) => void }) {
  const [body, setBody] = useState(p.body);
  const [doEx, setDoEx] = useState(p.do_examples ?? "");
  const [dontEx, setDontEx] = useState(p.dont_examples ?? "");
  const queryClient = useQueryClient();
  const settle = (w: PolicyWatch, message: string) => {
    onDone(w);
    queryClient.invalidateQueries({ queryKey: ["messaging-context"], exact: true });
    toast.success(message);
  };
  const approve = useMutation({
    mutationFn: () => contextService.approvePolicyUpdate(p.id, { body: body.trim(), do_examples: doEx.trim() || null, dont_examples: dontEx.trim() || null }),
    onSuccess: (w) => settle(w, `${p.norm_title} updated. The analysis uses the new wording from now on.`),
    onError: (err) => toast.error(`Couldn't approve the update: ${(err as Error).message}`),
  });
  const reject = useMutation({
    mutationFn: () => contextService.rejectPolicyUpdate(p.id),
    onSuccess: (w) => settle(w, `Update to ${p.norm_title} rejected. The norm stays as it was.`),
    onError: (err) => toast.error(`Couldn't reject the update: ${(err as Error).message}`),
  });
  const busy = approve.isPending || reject.isPending;

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{p.norm_title}</p>
          <p className="text-[11px] text-muted-foreground">
            Policy page changed · drafted {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => reject.mutate()} disabled={busy}>
            {reject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Reject
          </Button>
          <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => approve.mutate()} disabled={busy || !body.trim()}>
            {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
          </Button>
        </div>
      </div>

      {p.changes.length > 0 && (
        <div className="rounded-md border border-border/60 bg-card p-2.5">
          <p className="mb-1 text-[11px] font-semibold text-foreground">What changed</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-foreground/90">
            {p.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
            {p.source_urls.map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-700 hover:underline dark:text-sky-300">
                {new URL(u).hostname}
                {new URL(u).pathname.replace(/\/$/, "")} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </p>
        </div>
      )}

      <Field label="Norm" current={p.current_body} value={body} onChange={setBody} rows={5} />
      <Field label="Do" current={p.current_do_examples} value={doEx} onChange={setDoEx} rows={2} />
      <Field label="Don't" current={p.current_dont_examples} value={dontEx} onChange={setDontEx} rows={2} />
    </div>
  );
}

/**
 * Super admins only: the platform content-policy norms are re-read from the platforms' policy pages every week, and
 * when a page changes Gemini drafts an updated norm. Nothing changes until a super admin approves it here.
 */
export default function PolicyWatchPanel() {
  const queryClient = useQueryClient();
  const [showPages, setShowPages] = useState(false);
  const watch = useQuery({
    queryKey: KEY,
    queryFn: contextService.policyWatch,
    refetchInterval: (q) => (q.state.data?.last_check?.status === "RUNNING" ? 4000 : false),
  });
  const set = (w: PolicyWatch) => queryClient.setQueryData(KEY, w);
  const check = useMutation({
    mutationFn: contextService.checkPolicyPages,
    onSuccess: set,
    onError: (err) => toast.error(`Couldn't start the check: ${(err as Error).message}`),
  });

  const run = watch.data?.last_check;
  const running = run?.status === "RUNNING";
  // Say how a check started here went once it finishes.
  const lastSeen = useRef<string | null>(null);
  useEffect(() => {
    if (!run) return;
    const key = `${run.id}:${run.status}`;
    if (lastSeen.current === `${run.id}:RUNNING` && run.status !== "RUNNING") {
      if (run.status === "FAILED") toast.error(`The policy check failed: ${run.error ?? "unknown error"}`);
      else toast.success(run.updated ? `Policy check done: ${run.updated} update(s) to review` : "Policy check done: no policy changes that affect the norms");
    }
    lastSeen.current = key;
  }, [run]);

  if (watch.isLoading) {
    return (
      <p className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading policy updates…
      </p>
    );
  }
  if (!watch.data) return null;
  const { proposals, pages, watched_pages } = watch.data;
  const summary = !run
    ? "Not checked yet."
    : running
    ? "Reading the policy pages…"
    : run.status === "FAILED"
    ? `Last check failed ${formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}: ${run.error ?? "unknown error"}`
    : `Last checked ${formatDistanceToNow(new Date(run.finished_at ?? run.started_at), { addSuffix: true })}`;

  return (
    <div className="space-y-3 border-b border-border/60 bg-violet-50/50 px-4 py-3 dark:bg-violet-500/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-violet-600" /> Content policies are checked against the platforms&apos; policy pages every week
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-200">
              super admins only
            </span>
          </p>
          <p className={run?.status === "FAILED" ? "text-red-600" : "text-muted-foreground"}>
            {summary} ·{" "}
            <button type="button" onClick={() => setShowPages((v) => !v)} className="inline-flex items-center gap-0.5 font-semibold text-foreground hover:underline">
              watching {watched_pages} of {pages.length} pages <ChevronDown className={`h-3 w-3 transition-transform ${showPages ? "rotate-180" : ""}`} />
            </button>
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 bg-card text-xs" onClick={() => check.mutate()} disabled={running || check.isPending}>
          {running || check.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {running ? "Checking…" : "Check now"}
        </Button>
      </div>

      {showPages && (
        <ul className="space-y-1 rounded-lg border border-border/60 bg-card p-2.5 text-[11px]">
          {pages.map((pg) => (
            <li key={`${pg.norm_title}-${pg.url}`} className="flex items-start gap-2">
              {pg.watching ? <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
              <div className="min-w-0">
                <a href={pg.url} target="_blank" rel="noreferrer" className="break-all text-sky-700 hover:underline dark:text-sky-300">
                  {pg.url}
                </a>
                <span className="text-muted-foreground"> · {pg.norm_title}</span>
                {pg.watching ? (
                  pg.changed_at && <span className="text-muted-foreground"> · last changed {formatDistanceToNow(new Date(pg.changed_at), { addSuffix: true })}</span>
                ) : (
                  <p className="text-amber-700 dark:text-amber-300">{pg.error ?? "Not read yet."}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {proposals.length > 0 ? (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" /> {proposals.length} update{proposals.length === 1 ? "" : "s"} waiting for your approval
          </p>
          {proposals.map((p) => (
            <ProposalCard key={p.id} p={p} onDone={set} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">No updates waiting. When a policy page changes in a way that matters, the drafted update shows here.</p>
      )}
    </div>
  );
}
