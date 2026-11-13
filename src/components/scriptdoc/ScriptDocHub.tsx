import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { FilePlus2, FileText, Paperclip, Users } from "lucide-react";
import { toast } from "sonner";

import DeleteScriptMenu from "@/components/scriptdoc/DeleteScriptMenu";
import { UploadPagesDialog } from "@/components/scriptdoc/PagesRail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { scriptDocService } from "@/services/scriptDocService";
import type { DocSetSummary, DocStatus, DocSummary, ScriptTemplate } from "@/types/scriptDoc";

const STATUS: Record<DocStatus, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "bg-muted text-muted-foreground" },
  IN_REVIEW: { label: "In review", tone: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  LEVEL2_REVIEW: { label: "Level 2 approval", tone: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  APPROVED: { label: "Approved", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

type Scope = "mine" | "review" | "all";

function DocCard({ d, scope }: { d: DocSummary; scope: Scope }) {
  const s = STATUS[d.status];
  return (
    <li className="min-w-0">
      <Link
        to={`/script-docs/${d.id}`}
        className={cn(
          "flex h-full flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-muted/30",
          d.needs_you && "border-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/30",
        )}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold leading-snug">{d.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {scope === "mine" ? (d.reviewer_names.length ? `Reviewers: ${d.reviewer_names.join(", ")}` : "Not sent yet") : `by ${d.creator_name}`}
            </p>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 font-medium", s.tone)}>{s.label}</span>
            {d.status === "IN_REVIEW" && d.required > 0 && (
              <span className="text-muted-foreground">
                {d.checked_in}/{d.required} checked in
              </span>
            )}
            {d.needs_you && <span className="font-medium text-blue-700 dark:text-blue-300">Your turn</span>}
          </span>
          <span className="text-muted-foreground">{formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}</span>
        </div>
      </Link>
    </li>
  );
}

/** A creator's document: its scripts (pages) and where each stands. */
function SetCard({ d, onDelete }: { d: DocSetSummary; onDelete: (id: string) => Promise<void> }) {
  const parts = [
    { n: d.approved, label: "approved", tone: "text-emerald-700 dark:text-emerald-400" },
    { n: d.in_review, label: "in review", tone: "text-blue-700 dark:text-blue-400" },
    { n: d.changes_requested, label: "need changes", tone: "text-amber-700 dark:text-amber-400" },
    { n: d.draft, label: "draft", tone: "text-muted-foreground" },
  ].filter((p) => p.n > 0);
  return (
    <li className="relative min-w-0">
      {d.draft === d.total && (
        <DeleteScriptMenu className="absolute right-2 top-2 z-10" name={d.title} what={d.total === 1 ? "script" : "document and its scripts"} onDelete={() => onDelete(d.id)} />
      )}
      <Link
        to={`/script-docs/${d.first_script_id}`}
        className={cn(
          "flex h-full flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-muted/30",
          d.needs_you && "border-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/30",
        )}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 pr-6">
            <p className="line-clamp-2 text-sm font-semibold leading-snug">{d.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {d.total} script{d.total === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
          <span className="flex flex-wrap gap-x-3">
            {parts.map((p) => (
              <span key={p.label} className={p.tone}>
                {p.n} {p.label}
              </span>
            ))}
          </span>
          <span className="text-muted-foreground">{formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}</span>
        </div>
      </Link>
    </li>
  );
}

function NewScriptDialog({ template, onClose }: { template: ScriptTemplate | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const create = useMutation({
    mutationFn: () => scriptDocService.create(title.trim(), template!.key),
    onSuccess: (d) => navigate(`/script-docs/${d.id}`),
    onError: (e: any) => toast.error(e?.message ?? "Couldn't create the script"),
  });
  return (
    <Dialog open={Boolean(template)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New script: {template?.name}</DialogTitle>
          <DialogDescription>{template?.storyline}</DialogDescription>
        </DialogHeader>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Script title" autoFocus maxLength={300} />
        {template && template.key !== "blank" && template.rows.some((r) => r.time || r.voiceover || r.visual) && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2">Time</th>
                <th className="py-1">Beat</th>
              </tr>
            </thead>
            <tbody>
              {template.rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 pr-2 align-top tabular-nums">{r.time}</td>
                  <td className="py-1 text-muted-foreground">{r.voiceover || r.visual || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
            Create and open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Start from a template, or attach a script from a file. */
function TemplateGrid({ templates, onPick, onAttach }: { templates: ScriptTemplate[]; onPick: (t: ScriptTemplate) => void; onAttach: () => void }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <FilePlus2 className="h-3.5 w-3.5" /> Start from a template
      </p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {templates.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t)}
            className="flex flex-col gap-0.5 rounded-lg border bg-card p-3 text-left transition-colors hover:border-blue-300 hover:bg-muted/30"
          >
            <span className="text-sm font-medium">{t.name}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{t.description}</span>
            {t.duration && <span className="mt-1 text-[11px] text-muted-foreground">{t.duration}</span>}
          </button>
        ))}
        <button
          type="button"
          onClick={onAttach}
          className="flex flex-col gap-0.5 rounded-lg border border-dashed bg-card p-3 text-left transition-colors hover:border-blue-300 hover:bg-muted/30"
        >
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Paperclip className="h-3.5 w-3.5" /> Attach Script
          </span>
          <span className="line-clamp-2 text-xs text-muted-foreground">
            Upload a PDF, Word or text file. It is split into scripts, each on its own page to review.
          </span>
        </button>
      </div>
    </div>
  );
}

const GRID = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[112.5rem]:grid-cols-4";
const EMPTY = "rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground";

/** The cards for the tab: the creator's documents, or the scripts sent to a reviewer / every script for a manager. */
function DocLists({
  scope,
  sets,
  docs,
  onDeleteSet,
}: {
  scope: Scope;
  sets: { isLoading: boolean; data?: DocSetSummary[] };
  docs: { isLoading: boolean; error: unknown; data?: DocSummary[] };
  onDeleteSet: (id: string) => Promise<void>;
}) {
  if (scope === "mine") {
    if (sets.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
    if (!sets.data?.length) return <p className={EMPTY}>You haven't written a script yet. Pick a template above.</p>;
    return (
      <ul className={GRID}>
        {sets.data.map((d) => (
          <SetCard key={d.id} d={d} onDelete={onDeleteSet} />
        ))}
      </ul>
    );
  }
  if (docs.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (docs.error) return <p className="text-sm text-destructive">{docs.error instanceof Error ? docs.error.message : "Couldn't load the scripts."}</p>;
  if (!docs.data?.length) return <p className={EMPTY}>{scope === "review" ? "Nothing has been sent to you." : "No scripts yet."}</p>;
  return (
    <ul className={GRID}>
      {docs.data.map((d) => (
        <DocCard key={d.id} d={d} scope={scope} />
      ))}
    </ul>
  );
}

/**
 * The script documents hub: start a script from a template, open the ones you wrote, the ones sent to you for review, and
 * (Content Managers) every script. Scripts open in the live editor, where reviewers edit together.
 */
export default function ScriptDocHub() {
  const { hasPermission } = useAuth();
  const manager = hasPermission("CONTENT_MANAGE_DRAFTS");
  // Reviewers review scripts; they don't start them.
  const reviewer = hasPermission("CONTENT_REVIEW_VIEW");
  const [scope, setScope] = useState<Scope>(reviewer ? "review" : "mine");
  const [picked, setPicked] = useState<ScriptTemplate | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const templates = useQuery({ queryKey: ["script-doc-templates"], queryFn: scriptDocService.templates, staleTime: 3_600_000 });
  const docs = useQuery({
    queryKey: ["script-docs", scope],
    queryFn: () => (scope === "mine" ? Promise.resolve([] as DocSummary[]) : scriptDocService.list(scope)),
    refetchOnWindowFocus: true,
  });
  const sets = useQuery({ queryKey: ["script-docs", "sets"], queryFn: scriptDocService.sets, enabled: scope === "mine", refetchOnWindowFocus: true });

  const tabs: { v: Scope; label: string }[] = [
    ...(reviewer ? [] : [{ v: "mine" as Scope, label: "My scripts" }]),
    { v: "review", label: "Sent to me" },
    ...(manager ? [{ v: "all" as Scope, label: "All scripts" }] : []),
  ];
  const removeSet = async (id: string) => {
    await scriptDocService.removeSet(id);
    queryClient.invalidateQueries({ queryKey: ["script-docs"] });
    toast.success("Script deleted");
  };
  const waiting = scope === "mine" ? (sets.data ?? []).filter((d) => d.needs_you).length : (docs.data ?? []).filter((d) => d.needs_you).length;

  return (
    <section className="space-y-4" aria-labelledby="script-docs-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="script-docs-title" className="text-lg font-semibold tracking-tight">Script documents</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Write a script from a template and send it to reviewers. They open it together and edit it live, each in their own colour.
          </p>
        </div>
      </div>

      {!reviewer && scope === "mine" && <TemplateGrid templates={templates.data ?? []} onPick={setPicked} onAttach={() => setAttachOpen(true)} />}
      <UploadPagesDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        onUpload={async (file) => {
          const { created } = await scriptDocService.attach(file);
          // Wait for the lists to be read again, so the hub already shows the new document when the dialog closes.
          await queryClient.refetchQueries({ queryKey: ["script-docs"] });
          toast.success(`Attached ${created.length} script${created.length === 1 ? "" : "s"}`);
          if (created[0]) navigate(`/script-docs/${created[0].id}`);
        }}
      />

      <div>
        <div role="tablist" className="mb-3 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.v}
              role="tab"
              aria-selected={scope === t.v}
              type="button"
              onClick={() => setScope(t.v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                scope === t.v ? "border-blue-700 bg-blue-700 text-white" : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {t.v === "all" && <Users className="h-3.5 w-3.5" />}
              {t.label}
              {t.v === scope && waiting > 0 && <span className="rounded-full bg-white/25 px-1.5 text-[11px]">{waiting} for you</span>}
            </button>
          ))}
        </div>
        <DocLists scope={scope} sets={sets} docs={docs} onDeleteSet={removeSet} />
      </div>
      <NewScriptDialog key={picked?.key ?? "none"} template={picked} onClose={() => setPicked(null)} />
    </section>
  );
}
