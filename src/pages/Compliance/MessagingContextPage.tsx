import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, Loader2, Megaphone, Pencil, Plus, ScrollText, Smartphone, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import { useAuth } from "@/lib/AuthContext";
import { contextService } from "@/services/contextService";
import { submissionService } from "@/services/submissionService";
import type { ContextEntry, ContextEntryInput, ContextKind } from "@/types/context";

// Each kind keeps its own colour: on its tab, its entries and the help line.
const KINDS: { value: ContextKind; label: string; icon: typeof Megaphone; tone: string; active: string; help: string }[] = [
  {
    value: "BRAND_VOICE",
    tone: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    active: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200",
    label: "Brand voice",
    icon: Megaphone,
    help: "How each brand should sound: tone, words it uses and avoids, and examples. Scope it to the brand.",
  },
  {
    value: "FACT",
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    active: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200",
    label: "Facts",
    icon: BookOpenText,
    help: "What's true about products, partners and the company (e.g. which products are shipping vs in trials). Add the date and source.",
  },
  {
    value: "PLATFORM_NORM",
    tone: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    active: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-200",
    label: "Platform norms",
    icon: Smartphone,
    help: "What each platform's audience expects, so tone is judged against where it's posted.",
  },
  {
    value: "AUDIENCE_PROFILE",
    tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    active: "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200",
    label: "Audience profiles",
    icon: Users,
    help: "What each audience cares about and how they tend to read things.",
  },
];

const EMPTY = (kind: ContextKind): ContextEntryInput => ({
  kind,
  title: "",
  body: "",
  do_examples: null,
  dont_examples: null,
  brands: [],
  audiences: [],
  platforms: [],
  source: null,
  as_of: null,
  is_active: true,
});

function Chips({
  options,
  value,
  onChange,
  anyLabel,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  anyLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        aria-pressed={value.length === 0}
        onClick={() => onChange([])}
        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
          value.length === 0 ? "border-blue-600 bg-blue-600 text-white" : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        {anyLabel}
      </button>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              on ? "border-blue-600 bg-blue-600 text-white" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Messaging Context: the background the content analysis is given, so it judges tone against the brand's voice,
 * the platform and the audience, and checks claims against known facts.
 */
export default function MessagingContextPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("CONFIG_ROLES_UPDATE");
  const [kind, setKind] = useState<ContextKind>("BRAND_VOICE");
  const [editing, setEditing] = useState<ContextEntry | "new" | null>(null);
  const [form, setForm] = useState<ContextEntryInput>(EMPTY("BRAND_VOICE"));
  const [deleting, setDeleting] = useState<ContextEntry | null>(null);

  const entries = useQuery({ queryKey: ["messaging-context"], queryFn: contextService.list });
  const options = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 5 * 60_000 });

  const brandOptions = useMemo(() => (options.data?.brands ?? []).map((b) => ({ value: b.code, label: b.name })), [options.data]);
  const audienceOptions = useMemo(
    () => Object.entries(options.data?.audiences ?? {}).map(([value, label]) => ({ value, label })),
    [options.data]
  );
  const platformOptions = useMemo(
    () => (options.data?.platforms ?? []).map((p) => ({ value: p, label: PLATFORM_LABELS[p as SocialPlatform] ?? p })),
    [options.data]
  );
  const nameOf = (list: { value: string; label: string }[], v: string) => list.find((o) => o.value === v)?.label ?? v;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries.data ?? []) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [entries.data]);
  const shown = (entries.data ?? []).filter((e) => e.kind === kind);
  const current = KINDS.find((k) => k.value === kind)!;

  const done = (msg: string) => {
    queryClient.invalidateQueries({ queryKey: ["messaging-context"] });
    // Analyses that used an edited entry are now out of date.
    queryClient.invalidateQueries({ queryKey: ["sentiment"] });
    toast.success(msg);
  };
  const save = useMutation({
    mutationFn: () => (editing && editing !== "new" ? contextService.update(editing.id, form) : contextService.create(form)),
    onSuccess: () => {
      done(editing === "new" ? "Context added" : "Context saved");
      setEditing(null);
    },
    onError: (err) => toast.error(`Couldn't save it: ${(err as Error).message}`),
  });
  const toggle = useMutation({
    mutationFn: (e: ContextEntry) => contextService.update(e.id, { ...e, is_active: !e.is_active }),
    onSuccess: (e) => done(e.is_active ? "Turned on" : "Turned off: the analysis won't use it"),
    onError: (err) => toast.error(`Couldn't change it: ${(err as Error).message}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => contextService.remove(id),
    onSuccess: () => {
      done("Removed");
      setDeleting(null);
    },
    onError: (err) => toast.error(`Couldn't remove it: ${(err as Error).message}`),
  });

  const open = (e: ContextEntry | "new") => {
    setForm(e === "new" ? EMPTY(kind) : { ...e });
    setEditing(e);
  };
  const scopeText = (e: ContextEntry) =>
    [
      e.brands.length ? e.brands.map((b) => nameOf(brandOptions, b)).join(", ") : null,
      e.audiences.length ? e.audiences.map((a) => nameOf(audienceOptions, a)).join(", ") : null,
      e.platforms.length ? e.platforms.map((p) => nameOf(platformOptions, p)).join(", ") : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Everything";

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-4 sm:space-y-5 pb-6 animate-in fade-in duration-300">
      <DashboardHeader
        title="Messaging Context"
        subtitle="Background the sentiment analysis uses: brand voice, facts, platform norms and audience profiles."
        actions={
          canEdit ? (
            <Button size="sm" className="text-xs gap-1.5 font-semibold" onClick={() => open("new")}>
              <Plus className="w-3.5 h-3.5" /> Add {current.label.toLowerCase().replace(/s$/, "")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kind of context">
        {KINDS.map((k) => {
          const active = k.value === kind;
          return (
            <button
              key={k.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(k.value)}
              className={`inline-flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-xs font-semibold transition-colors ${
                active ? k.active : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`grid h-6 w-6 place-items-center rounded-md ${k.tone}`}>
                <k.icon className="w-3.5 h-3.5" />
              </span>
              {k.label} <span className="tabular-nums opacity-70">{counts[k.value] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <Card className="py-0 gap-0 border-border/80 shadow-xs overflow-hidden">
        <p className="flex items-start gap-2.5 px-4 py-3 border-b border-border/60 bg-muted/20 text-xs text-muted-foreground">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${current.tone}`}>
            <current.icon className="w-4 h-4" />
          </span>
          <span>
          {current.help} The analysis gets only the entries that match the content's brand, audience and platforms, treats
          them as background (not instructions), and shows which ones it used.
          </span>
        </p>
        {entries.isLoading ? (
          <p className="p-6 text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
          </p>
        ) : shown.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
            <span className={`mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl ${current.tone}`}>
              <ScrollText className="w-5 h-5" />
            </span>
            <p className="font-semibold text-foreground">No {current.label.toLowerCase()} yet</p>
            <p>
              {kind === "BRAND_VOICE"
                ? 'Until there is, the analysis rates brand fit as "no guidance".'
                : kind === "FACT"
                ? "Without facts the analysis can't tell whether claims like product availability are plausible."
                : "Add one to give the analysis this background."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {shown.map((e) => (
              <li key={e.id} className={`px-4 py-3 space-y-1.5 ${e.is_active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${current.tone}`}>
                    <current.icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {e.title}
                      {!e.is_active && <span className="ml-2 text-[11px] font-normal text-muted-foreground">(off)</span>}
                      {e.is_starter && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">starter</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Applies to: {scopeText(e)}
                      {e.as_of && ` · as of ${e.as_of}`}
                      {e.source && ` · source: ${e.source}`}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggle.mutate(e)} disabled={toggle.isPending}>
                        {e.is_active ? "Turn off" : "Turn on"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => open(e)}>
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-red-600" onClick={() => setDeleting(e)} aria-label={`Remove ${e.title}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap">{e.body}</p>
                {(e.do_examples || e.dont_examples) && (
                  <div className="grid gap-2 sm:grid-cols-2 text-[11px]">
                    {e.do_examples && (
                      <p className="rounded-md bg-emerald-500/5 px-2 py-1.5 text-emerald-900 dark:text-emerald-100">
                        <span className="font-semibold">Works well: </span>
                        {e.do_examples}
                      </p>
                    )}
                    {e.dont_examples && (
                      <p className="rounded-md bg-red-500/5 px-2 py-1.5 text-red-900 dark:text-red-100">
                        <span className="font-semibold">Avoid: </span>
                        {e.dont_examples}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{editing === "new" ? "Add context" : "Edit context"}</DialogTitle>
            <DialogDescription className="text-xs">{KINDS.find((k) => k.value === form.kind)?.help}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Kind</Label>
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    aria-pressed={form.kind === k.value}
                    onClick={() => setForm((f) => ({ ...f, kind: k.value }))}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                      form.kind === k.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctx-title" className="text-xs font-semibold">Title</Label>
              <Input id="ctx-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="text-xs" placeholder="e.g. ZenaDrone voice" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctx-body" className="text-xs font-semibold">Guidance</Label>
              <Textarea id="ctx-body" rows={4} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} className="text-xs" maxLength={2000} />
              <p className="text-[10px] text-muted-foreground text-right">{form.body.length}/2000</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ctx-do" className="text-xs font-semibold">Works well (optional)</Label>
                <Textarea id="ctx-do" rows={2} value={form.do_examples ?? ""} onChange={(e) => setForm((f) => ({ ...f, do_examples: e.target.value || null }))} className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctx-dont" className="text-xs font-semibold">Avoid (optional)</Label>
                <Textarea id="ctx-dont" rows={2} value={form.dont_examples ?? ""} onChange={(e) => setForm((f) => ({ ...f, dont_examples: e.target.value || null }))} className="text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Brands</Label>
              <Chips options={brandOptions} value={form.brands} onChange={(brands) => setForm((f) => ({ ...f, brands }))} anyLabel="All brands" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Audiences</Label>
              <Chips options={audienceOptions} value={form.audiences} onChange={(audiences) => setForm((f) => ({ ...f, audiences }))} anyLabel="All audiences" />
              {form.kind === "AUDIENCE_PROFILE" && form.audiences.length === 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">Pick the audience this profile describes; profiles without one aren't used.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Platforms</Label>
              <Chips options={platformOptions} value={form.platforms} onChange={(platforms) => setForm((f) => ({ ...f, platforms }))} anyLabel="All platforms" />
              {form.kind === "PLATFORM_NORM" && form.platforms.length === 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">Pick the platform these norms describe; norms without one aren't used.</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ctx-source" className="text-xs font-semibold">Source (optional)</Label>
                <Input id="ctx-source" value={form.source ?? ""} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value || null }))} className="text-xs" placeholder="e.g. Brand guidelines v2" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctx-asof" className="text-xs font-semibold">As of (optional)</Label>
                <Input id="ctx-asof" type="date" value={form.as_of ?? ""} onChange={(e) => setForm((f) => ({ ...f, as_of: e.target.value || null }))} className="text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" className="text-xs gap-1.5" disabled={!form.title.trim() || !form.body.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Remove "{deleting?.title}"?</DialogTitle>
            <DialogDescription className="text-xs">The analysis stops using it. To pause it instead, turn it off.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" className="text-xs gap-1.5" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>
              {remove.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
