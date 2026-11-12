import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Forward, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";

interface DelegateTarget {
  id: string;
  reference_code: string;
  title: string;
  brand_codes?: string[];
  brand_code?: string | null;
  reviewer_ids?: string[];
  created_by?: string | null;
}

/**
 * Hand the post in review to another reviewer. The delegate gets it in their queue; the person who delegated stays on
 * it, keeps seeing its status and can still decide. One approval from anyone on it approves it.
 */
export function DelegateReviewButton({ target, className = "" }: { target: DelegateTarget; className?: string }) {
  const [open, setOpen] = useState(false);
  const [toUser, setToUser] = useState("");
  const [note, setNote] = useState("");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Any reviewer can take it over, whatever brands they work on.
  const reviewers = useQuery({
    queryKey: ["reviewers", "all"],
    queryFn: () => submissionService.reviewers(),
    enabled: open,
  });
  const options = useMemo(() => {
    const taken = new Set([...(target.reviewer_ids ?? []), user?.id].filter(Boolean) as string[]);
    // The creator can't review their own post, except a super admin (the server applies the same rule).
    return (reviewers.data ?? []).filter((r) => !taken.has(r.id) && (r.id !== target.created_by || r.is_super_admin));
  }, [reviewers.data, target.reviewer_ids, target.created_by, user?.id]);

  const delegate = useMutation({
    mutationFn: () => submissionService.delegate(target.id, toUser, note.trim() || undefined),
    onSuccess: () => {
      const name = options.find((o) => o.id === toUser)?.name ?? "them";
      toast.success(`${target.reference_code} delegated to ${name}. You'll still see its status.`);
      queryClient.invalidateQueries({ queryKey: ["submission", target.id] });
      queryClient.invalidateQueries({ queryKey: ["submission-history", target.id] });
      queryClient.invalidateQueries({ queryKey: ["submission-delegations", target.id] });
      queryClient.invalidateQueries({ queryKey: ["delegations"] });
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      setOpen(false);
      setToUser("");
      setNote("");
    },
    onError: (err) => toast.error(`Couldn't delegate: ${(err as Error).message}`),
  });

  return (
    <>
      <Button variant="outline" size="sm" className={`gap-1.5 ${className}`} onClick={() => setOpen(true)}>
        <Forward className="h-4 w-4" />
        Delegate review
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delegate {target.reference_code}</DialogTitle>
            <DialogDescription>
              Send &ldquo;{target.title}&rdquo; to any other reviewer, whatever brand they work on. You stay on it:
              you'll still see its status and can still approve it or request changes. You can delegate a post once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="delegate-to">Delegate to</Label>
              <Select value={toUser} onValueChange={setToUser}>
                <SelectTrigger id="delegate-to" className="w-full">
                  <SelectValue placeholder={reviewers.isLoading ? "Loading reviewers…" : "Pick a reviewer"} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} <span className="text-muted-foreground">({o.email})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!reviewers.isLoading && options.length === 0 && (
                <p className="text-xs text-muted-foreground">There's nobody else to delegate to.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delegate-note">Note (optional)</Label>
              <Textarea
                id="delegate-note"
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What should they look at?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!toUser || delegate.isPending} onClick={() => delegate.mutate()} className="gap-1.5">
              {delegate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
              Delegate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Who handed this post to whom, newest first. Hidden when it was never delegated. */
export function DelegationTrail({ submissionId }: { submissionId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["submission-delegations", submissionId],
    queryFn: () => submissionService.submissionDelegations(submissionId),
  });
  if (!data.length) return null;
  return (
    <Card className="py-0 border-border/80 shadow-xs">
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delegation history</p>
        <ul className="space-y-1.5">
          {data.map((d) => (
            <li key={d.id} className="text-sm flex flex-wrap items-center gap-1.5">
              <span className="font-medium">{d.from_user_name ?? "Someone"}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{d.to_user_name ?? "Someone"}</span>
              <span className="text-xs text-muted-foreground">
                · v{d.version_number} · {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
              </span>
              {d.note && <span className="w-full text-xs text-muted-foreground pl-1">&ldquo;{d.note}&rdquo;</span>}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
