import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  X as XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import { policyService } from "@/services/policyService";
import { submissionService } from "@/services/submissionService";
import type { PolicyPage, PolicyRuleProposal, ProposalStatus, ProposalUpdate } from "@/types/policy";

const platformLabel = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;
const when = (iso?: string | null) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "never");

const LIGHT_CLASS: Record<string, string> = {
  RED: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200",
  YELLOW: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  GREEN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
};

type View = "PENDING" | "APPROVED" | "REJECTED" | "SOURCES";

/**
 * Social Media Content Policy: rules the AI proposed from the platforms' own policy pages wait here for a person.
 * Approving one adds it to the rulebook (limited to the platforms and regions its policy covers); nothing is added on
 * its own. The Sources view shows every policy page, when it was last read, and lets a manager paste a page's text
 * when the site won't give it to an automated reader.
 */
export default function PolicyRulesTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("PENDING");
  const [editing, setEditing] = useState<PolicyRuleProposal | null>(null);
  const [rejecting, setRejecting] = useState<PolicyRuleProposal | null>(null);
  const [pasting, setPasting] = useState<PolicyPage | null>(null);

  const overview = useQuery({
    queryKey: ["policy-overview"],
    queryFn: policyService.overview,
    // While pages are read or proposals made in the background, keep the counts moving.
    refetchInterval: (q) =>
      q.state.data?.refreshing || q.state.data?.pages.some((p) => p.proposal_status === "RUNNING" || p.proposal_status === "PENDING")
        ? 4000
        : false,
  });
  const status: ProposalStatus | undefined = view === "SOURCES" ? undefined : view;
  const proposals = useQuery({
    queryKey: ["policy-proposals", status],
    queryFn: () => policyService.proposals(status),
    enabled: view !== "SOURCES",
    refetchInterval: overview.data?.refreshing ? 4000 : false,
  });
  const { data: options } = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions });

  const refreshAfter = () => {
    queryClient.invalidateQueries({ queryKey: ["policy-overview"] });
    queryClient.invalidateQueries({ queryKey: ["policy-proposals"] });
  };

  const refreshAll = useMutation({
    mutationFn: () => policyService.refreshAll(),
    onSuccess: (r) => {
      toast.info(r.started ? "Reading every policy page. New rules appear here as pages change." : r.detail ?? "Already reading");
      refreshAfter();
    },
    onError: (e: Error) => toast.error(`Couldn't start: ${e.message}`),
  });
  const fetchPage = useMutation({
    mutationFn: (id: string) => policyService.fetchPage(id),
    onSuccess: (r) => {
      toast[r.status === "READ" ? "success" : "info"](
        r.status !== "READ" ? "The page wouldn't give its text. Paste it instead." : r.changed ? "Read. New rules were proposed." : "Read. Nothing changed since last time."
      );
      refreshAfter();
    },
    onError: (e: Error) => toast.error(`Couldn't read the page: ${e.message}`),
  });
  const propose = useMutation({
    mutationFn: (id: string) => policyService.propose(id),
    onSuccess: () => {
      toast.info("Proposing rules again from this page. Undecided ones from it are replaced.");
      refreshAfter();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: (id: string) => policyService.approve(id),
    onSuccess: (p) => {
      toast.success(`${p.rule_number} added to the rulebook. Open posts are re-checked against it.`);
      refreshAfter();
      queryClient.invalidateQueries({ queryKey: ["compliance-rules"] });
    },
    onError: (e: Error) => toast.error(`Couldn't approve: ${e.message}`),
  });

  const pages = overview.data?.pages ?? [];
  const needsText = pages.filter((p) => p.status === "NEEDS_TEXT" || p.status === "FAILED").length;
  const working = overview.data?.refreshing || pages.some((p) => p.proposal_status === "RUNNING");
  const tabs: { key: View; label: string }[] = [
    { key: "PENDING", label: `Waiting for approval (${overview.data?.pending ?? 0})` },
    { key: "APPROVED", label: "In the rulebook" },
    { key: "REJECTED", label: "Rejected" },
    { key: "SOURCES", label: `Policy sources (${pages.length})` },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">{overview.data?.rulebook_title ?? "Social Media Content Policy"}</p>
            <p className="text-xs text-muted-foreground">
              Rules taken from each platform's own policies. The AI proposes them; nothing joins the rulebook until it's
              approved here. Each rule only applies to posts for the platforms and regions its policy covers.
            </p>
            {needsText > 0 && (
              <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {needsText} page{needsText === 1 ? "" : "s"} couldn't be read automatically. Paste their text under Policy
                sources.
              </p>
            )}
          </div>
          {canManage && (
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => refreshAll.mutate()} disabled={working || refreshAll.isPending}>
              {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {working ? "Reading pages..." : "Read all pages now"}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={view === t.key}
            onClick={() => setView(t.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              view === t.key ? "border-blue-600 bg-blue-600 text-white" : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "SOURCES" ? (
        <SourcesList
          pages={pages}
          loading={overview.isLoading}
          canManage={canManage}
          onFetch={(id) => fetchPage.mutate(id)}
          fetchingId={fetchPage.isPending ? fetchPage.variables : undefined}
          onPropose={(id) => propose.mutate(id)}
          onPaste={setPasting}
        />
      ) : proposals.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </p>
      ) : !proposals.data?.length ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-xs text-muted-foreground">
            {view === "PENDING"
              ? pages.some((p) => p.last_fetched_at)
                ? "Nothing waiting. New rules appear here when a platform's policy changes."
                : "No policy pages have been read yet. Use \"Read all pages now\" to start."
              : view === "APPROVED"
              ? "No policy rules approved yet."
              : "Nothing rejected."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {proposals.data.map((p) => (
            <ProposalCard
              key={p.id}
              p={p}
              canManage={canManage}
              approving={approve.isPending && approve.variables === p.id}
              onApprove={() => approve.mutate(p.id)}
              onEdit={() => setEditing(p)}
              onReject={() => setRejecting(p)}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditDialog
          proposal={editing}
          regions={(options?.regions ?? []).filter((r) => r !== "Global")}
          platforms={options?.platforms ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refreshAfter();
          }}
        />
      )}
      {rejecting && (
        <RejectDialog
          proposal={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            refreshAfter();
          }}
        />
      )}
      {pasting && (
        <PasteDialog
          page={pasting}
          onClose={() => setPasting(null)}
          onDone={() => {
            setPasting(null);
            refreshAfter();
          }}
        />
      )}
    </div>
  );
}

function Chips({ label, values, empty }: { label: string; values: string[]; empty?: string }) {
  if (!values.length && !empty) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      <span className="text-muted-foreground">{label}:</span>
      {values.length ? (
        values.map((v) => (
          <span key={v} className="rounded bg-muted px-1.5 py-px text-foreground">
            {v}
          </span>
        ))
      ) : (
        <span className="text-foreground">{empty}</span>
      )}
    </div>
  );
}

function ProposalCard({
  p,
  canManage,
  approving,
  onApprove,
  onEdit,
  onReject,
}: {
  p: PolicyRuleProposal;
  canManage: boolean;
  approving: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
}) {
  const duplicate = p.similar_rules.find((s) => s.overlap === "DUPLICATE");
  return (
    <Card className="border-border/70">
      <CardContent className="space-y-2.5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {p.rule_number && <Badge variant="outline" className="text-[10px]">{p.rule_number}</Badge>}
              <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${LIGHT_CLASS[p.traffic_light] ?? ""}`}>
                {p.traffic_light} · {p.severity}
              </span>
              <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                {p.evaluation_mode === "CONTEXT" ? "AI reads it in context" : "Phrase rule"}
              </span>
              {p.paid_ads_only && (
                <span className="rounded bg-violet-100 px-1.5 py-px text-[10px] font-medium text-violet-800 dark:bg-violet-500/15 dark:text-violet-200">
                  Paid ads only
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">{p.title}</p>
          </div>
          {canManage && p.status === "PENDING" && (
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onEdit}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onReject}>
                <XIcon className="h-3 w-3" /> Reject
              </Button>
              <Button size="sm" className="h-7 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700" onClick={onApprove} disabled={approving}>
                {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-foreground">{p.summary}</p>

        <div className="space-y-1">
          <Chips label="Platforms" values={p.platforms.map(platformLabel)} />
          <Chips label="Regions" values={p.regions} empty="All regions" />
          <Chips label="Looks for" values={p.prohibited_terms} />
          <Chips label="Needs" values={p.required_disclaimers} />
          {p.required_disclaimers.length > 0 && <Chips label="When it mentions" values={p.disclaimer_triggers} empty="Always" />}
        </div>
        {p.evaluation_guidance && <p className="text-[11px] text-muted-foreground"><span className="font-medium">How to judge:</span> {p.evaluation_guidance}</p>}
        {p.remediation_guidance && <p className="text-[11px] text-muted-foreground"><span className="font-medium">How to fix:</span> {p.remediation_guidance}</p>}

        <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 text-[11px]">
          <p className="flex items-center gap-1 font-medium text-foreground">
            <Globe className="h-3 w-3" /> {p.policy_names.join(" · ") || "Source"}
            <a href={p.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-blue-600 hover:underline">
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          {p.source_quote ? (
            <p className="mt-1 italic text-muted-foreground">"{p.source_quote}"</p>
          ) : (
            <p className="mt-1 text-amber-700 dark:text-amber-300">The AI's quote wasn't found on the page. Check the policy before approving.</p>
          )}
        </div>

        {p.similar_rules.length > 0 && (
          <div
            className={`rounded-md border p-2.5 text-[11px] ${
              duplicate ? "border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10" : "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10"
            }`}
          >
            <p className="font-semibold text-foreground">
              {duplicate ? `Probably already covered by ${duplicate.rule_number}` : "Similar existing rules"}
            </p>
            <ul className="mt-1 space-y-0.5">
              {p.similar_rules.map((s) => (
                <li key={s.rule_number}>
                  <span className="font-medium text-foreground">{s.rule_number}</span> · {s.title}{" "}
                  <span className={s.overlap === "DUPLICATE" ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-200"}>
                    ({s.overlap === "DUPLICATE" ? "same requirement" : "overlaps"})
                  </span>
                  {s.reason && <span className="text-muted-foreground">: {s.reason}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.status !== "PENDING" && p.reviewed_at && (
          <p className="text-[11px] text-muted-foreground">
            {p.status === "APPROVED" ? "Approved" : "Rejected"} by {p.reviewed_by_name ?? "someone"} on{" "}
            {format(new Date(p.reviewed_at), "MMM d, yyyy")}
            {p.review_note ? `: ${p.review_note}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const PAGE_STATUS: Record<string, { label: string; cls: string }> = {
  NEW: { label: "Not read yet", cls: "bg-muted text-muted-foreground" },
  READ: { label: "Read", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" },
  NEEDS_TEXT: { label: "Needs its text pasted", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200" },
  FAILED: { label: "Couldn't read", cls: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200" },
};

function SourcesList({
  pages,
  loading,
  canManage,
  onFetch,
  fetchingId,
  onPropose,
  onPaste,
}: {
  pages: PolicyPage[];
  loading: boolean;
  canManage: boolean;
  onFetch: (id: string) => void;
  fetchingId?: string;
  onPropose: (id: string) => void;
  onPaste: (p: PolicyPage) => void;
}) {
  if (loading) return <p className="text-xs text-muted-foreground">Loading...</p>;
  return (
    <div className="space-y-2">
      {pages.map((page) => {
        const st = PAGE_STATUS[page.status] ?? PAGE_STATUS.NEW;
        const regions = [...new Set(page.sources.map((s) => s.region))];
        const platforms = [...new Set(page.sources.map((s) => platformLabel(s.platform)))];
        const names = [...new Set(page.sources.map((s) => s.policy_name))];
        return (
          <Card key={page.id} className="border-border/70">
            <CardContent className="space-y-1.5 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">{names.join(" · ")}</p>
                  <a href={page.url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-blue-600 hover:underline">
                    {page.url}
                  </a>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
              </div>
              <Chips label="Platforms" values={platforms} />
              <Chips label="Regions" values={regions} />
              <p className="text-[11px] text-muted-foreground">
                Read {when(page.last_fetched_at)}
                {page.last_changed_at ? ` · changed ${when(page.last_changed_at)}` : ""}
                {page.text_chars ? ` · ${page.text_chars.toLocaleString()} characters${page.fetch_method === "PASTED" ? " (pasted)" : ""}` : ""}
                {` · ${page.pending_count} waiting, ${page.approved_count} approved`}
                {page.proposal_status === "RUNNING" || page.proposal_status === "PENDING" ? " · proposing rules..." : ""}
              </p>
              {page.error && <p className="text-[11px] text-amber-700 dark:text-amber-300">{page.error}</p>}
              {page.proposal_error && page.proposal_status === "FAILED" && (
                <p className="text-[11px] text-red-700 dark:text-red-300">{page.proposal_error}</p>
              )}
              {canManage && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onFetch(page.id)} disabled={fetchingId === page.id}>
                    {fetchingId === page.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Read now
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onPaste(page)}>
                    <ClipboardPaste className="h-3 w-3" /> Paste text
                  </Button>
                  {page.text_chars > 0 && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onPropose(page.id)}>
                      <Sparkles className="h-3 w-3" /> Propose again
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function EditDialog({
  proposal,
  regions,
  platforms,
  onClose,
  onSaved,
}: {
  proposal: PolicyRuleProposal;
  regions: string[];
  platforms: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: proposal.title,
    summary: proposal.summary,
    severity: proposal.severity,
    traffic_light: proposal.traffic_light,
    evaluation_mode: proposal.evaluation_mode,
    terms: proposal.prohibited_terms.join("\n"),
    disclaimers: proposal.required_disclaimers.join("\n"),
    triggers: proposal.disclaimer_triggers.join("\n"),
    remediation: proposal.remediation_guidance ?? "",
    platforms: proposal.platforms,
    regions: proposal.regions,
    paid: proposal.paid_ads_only,
  });
  const save = useMutation({
    mutationFn: () => {
      const data: ProposalUpdate = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        severity: form.severity,
        traffic_light: form.traffic_light,
        evaluation_mode: form.evaluation_mode,
        prohibited_terms: lines(form.terms),
        required_disclaimers: lines(form.disclaimers),
        disclaimer_triggers: lines(form.triggers),
        remediation_guidance: form.remediation.trim() || undefined,
        platforms: form.platforms,
        regions: form.regions,
        paid_ads_only: form.paid,
      };
      return policyService.update(proposal.id, data);
    },
    onSuccess: () => {
      toast.success("Saved. Approve it when it's right.");
      onSaved();
    },
    onError: (e: Error) => toast.error(`Couldn't save: ${e.message}`),
  });
  const toggle = (key: "platforms" | "regions", v: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit proposed rule</DialogTitle>
          <DialogDescription>Changes apply to the rule that's created when you approve it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Summary</Label>
            <Textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Light</Label>
              <Select value={form.traffic_light} onValueChange={(v) => setForm({ ...form, traffic_light: v })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["RED", "YELLOW", "GREEN"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Judged by</Label>
              <Select value={form.evaluation_mode} onValueChange={(v) => setForm({ ...form, evaluation_mode: v as "RULE" | "CONTEXT" })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTEXT">AI reads it in context</SelectItem>
                  <SelectItem value="RULE">Phrase rule</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Phrases to look for (one per line)</Label>
              <Textarea rows={4} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Required disclaimers</Label>
              <Textarea rows={4} value={form.disclaimers} onChange={(e) => setForm({ ...form, disclaimers: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Disclaimer needed when it mentions</Label>
              <Textarea rows={4} value={form.triggers} onChange={(e) => setForm({ ...form, triggers: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">How to fix</Label>
            <Textarea rows={2} value={form.remediation} onChange={(e) => setForm({ ...form, remediation: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => (
                <label key={p} className="flex items-center gap-1.5">
                  <Checkbox checked={form.platforms.includes(p)} onCheckedChange={() => toggle("platforms", p)} /> {platformLabel(p)}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Regions (none ticked: all regions)</Label>
            <div className="flex flex-wrap gap-2">
              {regions.map((r) => (
                <label key={r} className="flex items-center gap-1.5">
                  <Checkbox checked={form.regions.includes(r)} onCheckedChange={() => toggle("regions", r)} /> {r}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5">
            <Checkbox checked={form.paid} onCheckedChange={(v) => setForm({ ...form, paid: v === true })} /> Only for paid ads
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim() || !form.summary.trim() || !form.platforms.length}>
            {save.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ proposal, onClose, onDone }: { proposal: PolicyRuleProposal; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const reject = useMutation({
    mutationFn: () => policyService.reject(proposal.id, note.trim() || undefined),
    onSuccess: () => {
      toast.info("Rejected. It won't be added to the rulebook.");
      onDone();
    },
    onError: (e: Error) => toast.error(`Couldn't reject: ${e.message}`),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject "{proposal.title}"?</DialogTitle>
          <DialogDescription>It stays in the Rejected list with your reason, and is never added to the rulebook.</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} placeholder="Why (optional), e.g. already covered by Rule 22" value={note} onChange={(e) => setNote(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasteDialog({ page, onClose, onDone }: { page: PolicyPage; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const paste = useMutation({
    mutationFn: () => policyService.pasteText(page.id, text),
    onSuccess: (r) => {
      toast[r.changed ? "success" : "info"](r.changed ? "Saved. Rules are being proposed from it." : "That's the same text as last time.");
      onDone();
    },
    onError: (e: Error) => toast.error(`Couldn't save: ${e.message}`),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste the policy text</DialogTitle>
          <DialogDescription>
            Open{" "}
            <a href={page.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              the policy page
            </a>{" "}
            in your browser, select all its text, copy it and paste it here.
          </DialogDescription>
        </DialogHeader>
        <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder="Policy text..." />
        <p className="text-[11px] text-muted-foreground">{text.trim().length.toLocaleString()} characters (at least 200)</p>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => paste.mutate()} disabled={paste.isPending || text.trim().length < 200}>
            {paste.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Save and propose rules
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
