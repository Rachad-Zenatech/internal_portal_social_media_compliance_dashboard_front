import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardCheck,
  FilePen,
  History,
  Loader2,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import DeleteDraftDialog from "@/components/submissions/DeleteDraftDialog";
import ReviewCommentsPanel from "@/components/submissions/ReviewCommentsPanel";
import ReviewDecisionPanel, { ChangesRequestedBanner } from "@/components/submissions/ReviewDecisionPanel";
import ApprovalActions from "@/components/submissions/ApprovalActions";
import { useReviewComments } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import { DueBadge, SubmissionFileRow, SubmissionStatusBadge, UnderReviewBadge, authedFileUrl, isAnalysing } from "@/components/submissions/submissionUi";
import { submissionService } from "@/services/submissionService";
import { useVideoThumbnail } from "@/lib/videoThumbnail";
import CheckCoverage from "@/components/submissions/CheckCoverage";
import type { ReviewJob, StoredCheck, Submission, SubmissionVersion } from "@/types/submission";

const TYPE_LABELS: Record<string, string> = {
  VIDEO: "Video",
  SOCIAL_POST: "Social post",
  CAROUSEL: "Carousel",
  IMAGE: "Image",
  BLOG: "Blog / article",
  AD: "Paid ad",
};

const JOB_STATUS: Record<string, string> = {
  AWAITING_REVIEW: "Awaiting review",
  WITHDRAWN: "Withdrawn",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
};

function Panel({ title, icon: Icon, children, aside }: { title: string; icon: typeof History; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Card className="py-0 gap-0 border-border/80 shadow-xs">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" /> {title}
        </h2>
        {aside}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </Card>
  );
}

function LightBadge({ light, score }: { light?: string | null; score?: number | null }) {
  if (score == null) return null;
  const cls =
    light === "RED"
      ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
      : light === "YELLOW"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  return (
    <Badge variant="outline" className={`text-[11px] font-semibold ${cls}`}>
      {score}/100
    </Badge>
  );
}

/** Draft → Submitted → In review → Decision, highlighting where this submission is. */
function StatusTrack({ s }: { s: Submission }) {
  const decided = ["APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(s.status);
  const steps = [
    { label: "Draft", done: true, current: s.status === "DRAFT" },
    { label: "Submitted", done: s.current_version > 0, current: false },
    { label: "In review", done: s.status === "IN_REVIEW" || decided, current: s.status === "IN_REVIEW" },
    {
      label: decided ? s.status.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "Decision",
      done: decided,
      current: decided,
    },
  ];
  return (
    <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              step.current
                ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                : step.done
                ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                : "border-border text-muted-foreground"
            }`}
          >
            {step.done && !step.current ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
            {step.label}
          </span>
          {i < steps.length - 1 && <span className="w-4 sm:w-8 h-px bg-border" />}
        </li>
      ))}
    </ol>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 py-1.5 text-sm">
      <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
      <div className="min-w-0 break-words">{children || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function JobCard({ job }: { job: ReviewJob }) {
  const check = job.automated_check;
  return (
    <div className="rounded-lg border border-border/70 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Version {job.version_number}</span>
        <div className="flex items-center gap-1.5">
          {isAnalysing(job.automated_check as StoredCheck | null) ? <UnderReviewBadge /> : <LightBadge light={job.traffic_light} score={job.score} />}
          <Badge variant="outline" className="text-[11px]">
            {JOB_STATUS[job.status] ?? job.status}
          </Badge>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Submitted {format(new Date(job.created_at), "MMM d, h:mm a")}</p>
      {job.decided_at && (
        <div
          className={`rounded-md px-2 py-1.5 text-[11px] ${
            job.decision === "APPROVE" ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" : "bg-amber-500/10 text-amber-900 dark:text-amber-100"
          }`}
        >
          <p className="font-semibold">
            {job.decision === "APPROVE" ? "Approved" : "Changes requested"}
            {job.decided_by_name && ` by ${job.decided_by_name}`} · {format(new Date(job.decided_at), "MMM d, h:mm a")}
          </p>
          {job.decision_notes && <p className="mt-0.5 whitespace-pre-wrap">"{job.decision_notes}"</p>}
        </div>
      )}
      {check && check.violations.length > 0 && (
        <ul className="space-y-1">
          {check.violations.map((v) => (
            <li key={v.rule_id} className="text-[11px] flex items-start gap-1.5">
              {v.traffic_light === "RED" ? (
                <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-px" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" />
              )}
              <span>
                <span className="font-semibold">{v.rule_number}</span> {v.title}: {v.flagged_terms.map((t) => `"${t}"`).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {check && check.violations.length === 0 && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Automated check found no issues in the text.
        </p>
      )}
      {check && <CheckCoverage check={check} />}
      {job.manual_checks && job.manual_checks.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Confirmed by the reviewer:</span>{" "}
          {job.manual_checks.map((m) => `${m.rule_number} (${m.title})`).join(", ")}
        </p>
      )}
    </div>
  );
}

function VersionRow({ v, isCurrent }: { v: SubmissionVersion; isCurrent: boolean }) {
  const [open, setOpen] = useState(false);
  const snap = v.snapshot;
  return (
    <div className="rounded-lg border border-border/70">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex items-center gap-2 text-xs font-semibold">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          Version {v.version_number}
          {isCurrent && <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">Current</Badge>}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {v.created_by_name ? `${v.created_by_name} · ` : ""}
          {format(new Date(v.created_at), "MMM d, h:mm a")}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1 border-t border-border/60 pt-2">
          <DetailRow label="Title">{snap.title}</DetailRow>
          <DetailRow label={(snap.accounts?.length ?? 0) > 1 ? "Accounts" : "Account"}>
            {snap.accounts?.length ? snap.accounts.map((a) => a.label).join(", ") : snap.account?.label}
          </DetailRow>
          <DetailRow label="Platforms">{snap.platforms.map((p) => PLATFORM_LABELS[p as SocialPlatform] ?? p).join(", ")}</DetailRow>
          <DetailRow label="Publish date">{snap.publish_at ? format(new Date(snap.publish_at), "MMM d, yyyy") : null}</DetailRow>
          <DetailRow label="Caption">
            {snap.caption_text ? <span className="whitespace-pre-wrap text-xs">{snap.caption_text}</span> : null}
          </DetailRow>
          <DetailRow label="Files">
            {snap.files.length ? <span className="text-xs">{snap.files.map((f) => f.original_name).join(", ")}</span> : null}
          </DetailRow>
          <DetailRow label="Reviewers">{snap.reviewer_route.join(", ")}</DetailRow>
        </div>
      )}
    </div>
  );
}

/** Main video preview, using the most representative frame as its poster. */
function PreviewVideo({ url }: { url: string }) {
  const { dataUrl } = useVideoThumbnail(url);
  return <video src={url} poster={dataUrl ?? undefined} controls preload="metadata" className="max-h-[420px] max-w-full rounded-lg bg-black" />;
}

export default function SubmissionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const submissionQuery = useQuery({ queryKey: ["submission", id], queryFn: () => submissionService.get(id), enabled: Boolean(id), staleTime: 0 });
  const optionsQuery = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 60_000 });
  const historyQuery = useQuery({ queryKey: ["submission-history", id], queryFn: () => submissionService.history(id), enabled: Boolean(id), staleTime: 0 });
  const s = submissionQuery.data;
  const history = historyQuery.data;
  const { user, hasPermission, creatorView } = useAuth();
  const { comments } = useReviewComments(id);
  const isCreator = Boolean(s && user && s.created_by === user.id);
  const isReviewer = hasPermission("CONTENT_REVIEW_APPROVE");
  // A super admin viewing the app as a creator sees it as the creator would.
  const canReview = Boolean(s?.can_review) && !creatorView;

  // Show the reference code in the breadcrumb instead of the raw id.
  useEffect(() => {
    if (!s) return;
    document.dispatchEvent(
      new CustomEvent("set-breadcrumb-title", { detail: { path: `/submissions/${s.id}`, title: s.reference_code } })
    );
  }, [s]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["submission", id] });
    queryClient.invalidateQueries({ queryKey: ["submission-history", id] });
    queryClient.invalidateQueries({ queryKey: ["submissions"] });
  };

  const withdrawMutation = useMutation({
    mutationFn: () => submissionService.withdraw(id),
    onSuccess: (res) => {
      toast.success(`${res.reference_code} is back in draft. Edit it and submit again to create a new version.`);
      refresh();
    },
    onError: (err: Error) => toast.error(`Couldn't withdraw: ${err.message}`),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);

  if (submissionQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading submission...
      </div>
    );
  }
  if (submissionQuery.isError || !s) {
    return (
      <div className="py-24 text-center space-y-3">
        <p className="text-sm text-muted-foreground">This submission couldn't be found.</p>
        <Button size="sm" variant="outline" asChild>
          <Link to="/submissions">Back to Content Portal</Link>
        </Button>
      </div>
    );
  }

  const mainVideo = s.files.find((f) => f.kind === "MAIN" && f.mime_type.startsWith("video/"));
  const mainImage = s.files.find((f) => f.kind === "MAIN" && f.mime_type.startsWith("image/"));

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-4 sm:space-y-5 pb-6 animate-in fade-in duration-300">
      <DashboardHeader
        title={s.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-foreground">{s.reference_code}</span>
            <SubmissionStatusBadge status={s.status} />
            <DueBadge dueAt={s.due_at} kind={s.due_kind} />
            {s.current_version > 0 && <span>Version {s.current_version}</span>}
            <span>· Updated {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}</span>
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="outline" asChild className="text-xs gap-1.5 font-semibold">
              <Link to="/submissions">
                <ArrowLeft className="w-3.5 h-3.5" /> Content Portal
              </Link>
            </Button>
            {s.can_edit && (
              <Button size="sm" asChild className="text-xs gap-1.5 font-semibold bg-blue-600 hover:bg-blue-700 text-white">
                <Link to={`/submissions/new?id=${s.id}`}>
                  <FilePen className="w-3.5 h-3.5" /> Continue Editing
                </Link>
              </Button>
            )}
            {s.status === "IN_REVIEW" && isCreator && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={withdrawMutation.isPending} className="text-xs gap-1.5 font-semibold">
                    <RotateCcw className="w-3.5 h-3.5" /> Withdraw to Edit
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Withdraw {s.reference_code} from review?</AlertDialogTitle>
                    <AlertDialogDescription>
                      It goes back to draft so you can edit it. Version {s.current_version} stays in the history, and submitting
                      again creates version {s.current_version + 1}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => withdrawMutation.mutate()}>Withdraw</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {s.can_delete && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                className="text-xs gap-1.5 font-semibold text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Draft
              </Button>
            )}
          </>
        }
      />

      <Card className="py-0 border-border/80 shadow-xs">
        <div className="px-4 py-3">
          <StatusTrack s={s} />
        </div>
      </Card>

      {canReview && (
        <ReviewDecisionPanel
          target={{
            id: s.id,
            reference_code: s.reference_code,
            title: s.title,
            status: s.status,
            current_version: s.current_version,
            platforms: s.platforms,
            publish_at: s.publish_at,
            due_at: s.due_at,
            due_kind: s.due_kind,
            can_review: s.can_review,
            can_approve: s.can_approve,
            approver_names: s.approver_names,
            open_critical_flags: s.open_critical_flags,
            score: isAnalysing(s.latest_check) ? null : s.latest_check?.score ?? null,
            manual_rules: s.latest_check?.manual_review_rules,
          }}
        />
      )}
      {s.status === "IN_REVIEW" && !canReview && (
        <p className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-xs text-blue-900 dark:text-blue-100">
          {isCreator
            ? "This is with a reviewer. You'll get a notification when they approve it or ask for changes."
            : "Waiting for a reviewer. Reviewers can't approve their own uploads."}
        </p>
      )}
      {s.status === "CHANGES_REQUESTED" && (
        <ChangesRequestedBanner
          submissionId={s.id}
          job={history?.review_jobs.find((j) => j.decision === "REQUEST_CHANGES") ?? null}
          openComments={comments.filter((c) => !c.resolved_at).length}
          canEdit={isCreator && s.can_edit}
        />
      )}
      {s.status === "APPROVED" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3">
          <CalendarCheck2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-900 dark:text-emerald-100 flex-1 min-w-[200px]">
            <strong>Approved</strong>
            {s.publish_at ? ` and on the content calendar for ${format(new Date(s.publish_at), "EEE MMM d, h:mm a")}.` : "."}
          </p>
          <Button size="sm" variant="outline" asChild className="text-xs">
            <Link to="/content-calendar">Open calendar</Link>
          </Button>
          {s.platforms[0] && (
            <Button size="sm" asChild className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              <Link to={`/content-calendar/publish/sub-${s.id}/${s.platforms[0]}`}>Publish</Link>
            </Button>
          )}
          <ApprovalActions target={s} isCreator={isCreator} />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 sm:gap-5 items-start">
        <div className="space-y-4 min-w-0">
          {(mainVideo || mainImage) && (
            <Panel title="Content Preview" icon={ClipboardCheck}>
              <div className="rounded-xl bg-muted/50 border border-border/60 flex items-center justify-center p-3">
                {mainVideo ? (
                  <PreviewVideo url={authedFileUrl(mainVideo.url)} />
                ) : mainImage ? (
                  <img src={authedFileUrl(mainImage.url)} alt={mainImage.original_name} className="max-h-[420px] max-w-full rounded-lg" />
                ) : null}
              </div>
            </Panel>
          )}

          <Panel title="Details" icon={FilePen}>
            <div className="divide-y divide-border/50">
              <DetailRow label="Content type">{TYPE_LABELS[s.content_type]}</DetailRow>
              <DetailRow label="Brand">{optionsQuery.data?.brands.find((b) => b.code === s.brand_code)?.name ?? s.brand_code}</DetailRow>
              <DetailRow label={(s.accounts?.length ?? 0) > 1 ? "Publishing accounts" : "Publishing account"}>
                {(s.accounts?.length || s.account) && (
                  <span className="flex flex-col gap-1">
                    {(s.accounts?.length ? s.accounts : [s.account!]).map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1.5">
                        <PlatformIcon platform={a.platform as SocialPlatform} className="w-4 h-4" /> {a.label}
                      </span>
                    ))}
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Platforms">
                {s.platforms.length > 0 && (
                  <span className="flex flex-wrap gap-2">
                    {s.platforms.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 text-xs">
                        <PlatformIcon platform={p as SocialPlatform} className="w-4 h-4" /> {PLATFORM_LABELS[p as SocialPlatform] ?? p}
                      </span>
                    ))}
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Audience">{(s.audience && optionsQuery.data?.audiences[s.audience]) || s.audience}</DetailRow>
              <DetailRow label="Region">{s.region}</DetailRow>
              <DetailRow label="Publish date">{s.publish_at ? format(new Date(s.publish_at), "MMM d, yyyy h:mm a") : null}</DetailRow>
              <DetailRow label="Rule sets">{s.rule_sets.join(", ")}</DetailRow>
              <DetailRow label="Caption / copy">
                {s.caption_text ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{s.caption_text}</p> : null}
              </DetailRow>
            </div>
          </Panel>

          <Panel title="Files" icon={ClipboardCheck} aside={<span className="text-[11px] text-muted-foreground">{s.files.length} attached</span>}>
            {s.files.length === 0 ? (
              <p className="text-xs text-muted-foreground">No files attached.</p>
            ) : (
              <div className="space-y-2">
                {s.files.map((f) => (
                  <SubmissionFileRow key={f.id} file={f} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          {s.current_version > 0 && (
            <Card className="py-0 gap-0 border-border/80 shadow-xs">
              <div className="p-4">
                <ReviewCommentsPanel
                  submissionId={s.id}
                  canComment={isCreator || isReviewer}
                  placeholder={isCreator && !canReview ? "Reply to the reviewer..." : "What should change, and why?"}
                  emptyText={s.status === "IN_REVIEW" ? "No comments yet. Reviewers' comments show here." : "No comments."}
                />
              </div>
            </Card>
          )}

          <Panel title="Review History" icon={ClipboardCheck}>
            {historyQuery.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : history && history.review_jobs.length > 0 ? (
              <div className="space-y-2">
                {history.review_jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Not submitted yet.{" "}
                {s.can_edit && (
                  <Link to={`/submissions/new?id=${s.id}`} className="text-blue-600 hover:underline">
                    Finish and submit
                  </Link>
                )}
              </p>
            )}
          </Panel>

          <Panel title="Past Versions" icon={History}>
            {history && history.versions.length > 0 ? (
              <div className="space-y-2">
                {history.versions.map((v) => (
                  <VersionRow key={v.version_number} v={v} isCurrent={v.version_number === s.current_version} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">A version is saved each time you submit.</p>
            )}
          </Panel>

          <Panel title="Activity" icon={History}>
            {history && history.events.length > 0 ? (
              <ol className="relative border-l border-border ml-1.5 space-y-3">
                {history.events.map((e) => (
                  <li key={e.id} className="ml-4">
                    <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-background" />
                    <p className="text-xs text-foreground">{e.message}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {e.actor_name ? `${e.actor_name} · ` : ""}
                      {format(new Date(e.created_at), "MMM d, h:mm a")}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            )}
          </Panel>
        </div>
      </div>

      <DeleteDraftDialog
        target={confirmDelete ? s : null}
        onClose={() => setConfirmDelete(false)}
        onDeleted={() => navigate("/submissions")}
      />
    </div>
  );
}
