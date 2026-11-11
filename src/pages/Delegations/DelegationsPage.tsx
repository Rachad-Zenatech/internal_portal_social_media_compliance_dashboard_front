import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, Forward, Loader2, Search } from "lucide-react";

import HelpIcon from "@/components/ui/HelpIcon";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SubmissionStatusBadge } from "@/components/submissions/submissionUi";
import { submissionService } from "@/services/submissionService";
import type { Delegation, DelegationDirection } from "@/types/submission";

const TABS: { value: DelegationDirection; label: string }[] = [
  { value: "all", label: "All" },
  { value: "to_me", label: "Delegated to me" },
  { value: "by_me", label: "Delegated by me" },
];

/** What happened to the delegated version: still waiting, or who decided and how. */
function Outcome({ d }: { d: Delegation }) {
  if (d.decision) {
    const label = d.decision === "APPROVE" ? "Approved" : "Changes requested";
    return (
      <span className="text-xs">
        {label}
        {d.decided_by_name && <> by <span className="font-medium">{d.decided_by_name}</span></>}
        {d.decided_at && <span className="text-muted-foreground"> · {formatDistanceToNow(new Date(d.decided_at), { addSuffix: true })}</span>}
      </span>
    );
  }
  if (d.version_number < d.current_version) {
    return <span className="text-xs text-muted-foreground">Superseded by v{d.current_version}</span>;
  }
  return <span className="text-xs text-amber-700 dark:text-amber-300">Waiting for a decision</span>;
}

/**
 * Delegation history: every post the reviewer handed to someone else, or that was handed to them, and where each
 * one stands now. The person who delegated keeps access to the post, so its status is always current here.
 */
export default function DelegationsPage() {
  const [tab, setTab] = useState<DelegationDirection>("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({
    queryKey: ["delegations", tab],
    queryFn: () => submissionService.delegations(tab),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const pending = useQuery({ queryKey: ["delegations", "count"], queryFn: () => submissionService.delegationCount() });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((d) =>
      [d.reference_code, d.title, d.from_user_name, d.to_user_name, d.note].some((v) => v?.toLowerCase().includes(q))
    );
  }, [data, search]);

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-300">
      <header className="flex flex-col gap-1 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <Forward className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">Delegations</h1>
          <HelpIcon text="Posts you delegated to another reviewer, or that were delegated to you. Whoever delegates stays on the post and can still decide; one approval from anyone on it approves it." />
        </div>
        <p className="text-sm text-muted-foreground">
          Track the status of reviews you handed off or picked up.
          {pending.data?.pending ? ` ${pending.data.pending} delegated to you still need a decision.` : ""}
        </p>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as DelegationDirection)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search posts or people" className="pl-8" />
        </div>
      </div>

      <Card className="py-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading delegations…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No delegations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Delegated</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate(`/submissions/${d.submission_id}`)}>
                    <TableCell className="max-w-xs">
                      <div className="font-medium truncate">{d.title}</div>
                      <div className="text-xs text-muted-foreground">{d.reference_code} · v{d.version_number}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span>{d.from_user_name ?? "Someone"}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{d.to_user_name ?? "Someone"}</span>
                      </div>
                      {d.note && <div className="text-xs text-muted-foreground truncate max-w-xs">&ldquo;{d.note}&rdquo;</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(d.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell><SubmissionStatusBadge status={d.status} /></TableCell>
                    <TableCell><Outcome d={d} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
