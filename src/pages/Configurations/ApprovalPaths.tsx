import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2, Pencil, Plus, Route, Trash2 } from "lucide-react";
import { toast } from "sonner";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthContext";
import { approvalPathService } from "@/services/approvalPathService";
import type { ApprovalPath, ApprovalPathInput } from "@/types/approvalPath";

const ANY = "__any__";
const EMPTY: ApprovalPathInput = { brand_code: null, audience: null, ceo_content: false, label: null, approver_ids: [] };

/**
 * Who gives final approval for which content. When a path matches a submission (by brand, audience, or Shaun's own
 * posts), only its approvers can approve it; any reviewer on the brand can still comment and send it back.
 */
export default function ApprovalPaths() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("CONFIG_USER_ROLE_ASSIGNMENT_UPDATE");
  const paths = useQuery({ queryKey: ["approval-paths"], queryFn: approvalPathService.list });
  const options = useQuery({ queryKey: ["approval-paths", "options"], queryFn: approvalPathService.options });

  const [editing, setEditing] = useState<ApprovalPath | "new" | null>(null);
  const [form, setForm] = useState<ApprovalPathInput>(EMPTY);
  const [deleting, setDeleting] = useState<ApprovalPath | null>(null);

  const brandName = (code: string | null) => options.data?.brands.find((b) => b.code === code)?.name ?? code;
  const audienceName = (code: string | null) => (code ? options.data?.audiences[code] ?? code : null);
  const describe = (p: ApprovalPathInput) =>
    [p.brand_code ? brandName(p.brand_code) : "Any brand", p.audience ? audienceName(p.audience) : "any audience"].join(" · ") +
    (p.ceo_content ? " · Shaun's posts only" : "");

  // Only people who can review the chosen brand can be its approvers.
  const eligible = useMemo(
    () => (options.data?.approvers ?? []).filter((a) => !form.brand_code || !a.brands.length || a.brands.includes(form.brand_code)),
    [options.data, form.brand_code]
  );

  const done = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ["approval-paths"] });
    // Who may approve what changed, so refresh anything showing review buttons.
    queryClient.invalidateQueries({ queryKey: ["submission"] });
    queryClient.invalidateQueries({ queryKey: ["submissions"] });
    queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    toast.success(message);
  };
  const save = useMutation({
    mutationFn: () =>
      editing && editing !== "new" ? approvalPathService.update(editing.id, form) : approvalPathService.create(form),
    onSuccess: () => {
      done(editing === "new" ? "Approval path added" : "Approval path saved");
      setEditing(null);
    },
    onError: (err) => toast.error(`Couldn't save it: ${(err as Error).message}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => approvalPathService.remove(id),
    onSuccess: () => {
      done("Approval path removed");
      setDeleting(null);
    },
    onError: (err) => toast.error(`Couldn't remove it: ${(err as Error).message}`),
  });

  const open = (p: ApprovalPath | "new") => {
    setForm(p === "new" ? EMPTY : { brand_code: p.brand_code, audience: p.audience, ceo_content: p.ceo_content, label: p.label, approver_ids: p.approver_ids });
    setEditing(p);
  };
  const toggleApprover = (id: string) =>
    setForm((f) => ({ ...f, approver_ids: f.approver_ids.includes(id) ? f.approver_ids.filter((a) => a !== id) : [...f.approver_ids, id] }));

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-4 sm:space-y-5 pb-6 animate-in fade-in duration-300">
      <DashboardHeader
        title="Approval Paths"
        subtitle="Who gives final approval for each brand and audience. Anyone reviewing the brand can still comment and request changes."
        actions={
          canEdit ? (
            <Button size="sm" className="text-xs gap-1.5 font-semibold" onClick={() => open("new")}>
              <Plus className="w-3.5 h-3.5" /> Add approval path
            </Button>
          ) : undefined
        }
      />

      <Card className="py-0 gap-0 border-border/80 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 text-xs text-muted-foreground space-y-1">
          <p>
            When content matches a path, only that path's approvers (or a super admin) can approve it, and they get a "needs your
            approval" notification. When several paths match, any of their approvers can approve. Content no path matches can be
            approved by any reviewer who works on its brand.
          </p>
        </div>
        {paths.isLoading ? (
          <p className="p-6 text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
          </p>
        ) : !paths.data?.length ? (
          <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
            <Route className="w-5 h-5 mx-auto" />
            <p className="font-semibold text-foreground">No approval paths yet</p>
            <p>Any reviewer on a brand can approve its content. Add a path to name the final approvers.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {paths.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    {p.ceo_content && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    {p.label || describe(p)}
                  </p>
                  {p.label && <p className="text-xs text-muted-foreground">{describe(p)}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {p.approver_names.length ? (
                      p.approver_names.map((n) => (
                        <span key={n} className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                          {n}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-amber-700 dark:text-amber-300">
                        Its approvers no longer have access, so any brand reviewer can approve.
                      </span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => open(p)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-red-600" onClick={() => setDeleting(p)} aria-label="Remove approval path">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{editing === "new" ? "Add approval path" : "Edit approval path"}</DialogTitle>
            <DialogDescription className="text-xs">Choose what content it covers and who gives final approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Brand</Label>
                <Select value={form.brand_code ?? ANY} onValueChange={(v) => setForm((f) => ({ ...f, brand_code: v === ANY ? null : v }))}>
                  <SelectTrigger size="sm" className="text-xs w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY} className="text-xs">Any brand</SelectItem>
                    {options.data?.brands.map((b) => (
                      <SelectItem key={b.code} value={b.code} className="text-xs">{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Audience</Label>
                <Select value={form.audience ?? ANY} onValueChange={(v) => setForm((f) => ({ ...f, audience: v === ANY ? null : v }))}>
                  <SelectTrigger size="sm" className="text-xs w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY} className="text-xs">Any audience</SelectItem>
                    {Object.entries(options.data?.audiences ?? {}).map(([code, name]) => (
                      <SelectItem key={code} value={code} className="text-xs">{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.ceo_content}
                onChange={(e) => setForm((f) => ({ ...f, ceo_content: e.target.checked }))}
                className="accent-current"
              />
              Only Shaun's own posts (his account or the "Shaun CEO Thought Leadership" rule set)
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="path-label" className="text-xs font-semibold">Name (optional)</Label>
              <Input
                id="path-label"
                value={form.label ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value || null }))}
                placeholder="e.g. Sensitive defense content"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Final approvers</Label>
              {eligible.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nobody can review this brand yet. Give someone a reviewer role (and the brand) in Role Assignments.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {eligible.map((a) => {
                    const on = form.approver_ids.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        aria-pressed={on}
                        title={a.email}
                        onClick={() => toggleApprover(a.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          on ? "border-blue-600 bg-blue-600 text-white" : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Only people with a reviewer role who work on this brand are listed.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" className="text-xs gap-1.5" disabled={!form.approver_ids.length || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Remove this approval path?</DialogTitle>
            <DialogDescription className="text-xs">
              {deleting && (deleting.label || describe(deleting))}. Content it covered can then be approved by any reviewer on its brand.
            </DialogDescription>
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
