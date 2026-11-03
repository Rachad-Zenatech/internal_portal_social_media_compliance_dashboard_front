import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StageSteps } from "@/components/script/ScriptDiff";
import { useScriptActions } from "@/hooks/useScript";
import type { ScriptStage } from "@/types/script";

/**
 * The script step at the top of a video post's upload section: upload the script, send it for review, and see where
 * it is. The video upload below stays locked until the script is approved.
 */
export default function ScriptStageCard({
  submissionId,
  stage,
  onAddScript,
  canEdit,
}: {
  submissionId: string | null;
  stage?: ScriptStage;
  onAddScript: () => void;
  canEdit: boolean;
}) {
  const status = stage?.status ?? "DRAFT";
  const latest = stage?.versions.at(-1);
  const decided = stage ? [...stage.versions].reverse().find((v) => v.review_decision) : undefined;
  const reading =
    stage?.file_status === "PENDING" ||
    stage?.file_status === "PROCESSING" ||
    (Boolean(stage?.file_name) && stage?.file_status == null);
  const scriptLink = submissionId ? `/submissions/${submissionId}/script` : "#";

  if (status === "APPROVED") {
    return (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <p className="flex items-center gap-2 text-[13px] font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4" /> Script approved. Add your video below; it's checked against the approved script.
        </p>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={scriptLink}>View the script</Link>
        </Button>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onAddScript}>
              <FileText className="w-3.5 h-3.5" /> Replace script
            </Button>
          )}
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to={scriptLink}>View the script</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-500/30 dark:bg-blue-500/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Script first</p>
        <StageSteps status={status} compact />
      </div>
      <Body
        status={status}
        stage={stage}
        submissionId={submissionId}
        reading={reading}
        onAddScript={onAddScript}
        canEdit={canEdit}
        scriptLink={scriptLink}
        sentAt={latest?.created_at}
        note={decided?.review_note ?? null}
        reviewer={decided?.reviewed_by_name ?? null}
      />
    </div>
  );
}

function Body({
  status,
  stage,
  submissionId,
  reading,
  onAddScript,
  canEdit,
  scriptLink,
  sentAt,
  note,
  reviewer,
}: {
  status: string;
  stage?: ScriptStage;
  submissionId: string | null;
  reading: boolean;
  onAddScript: () => void;
  canEdit: boolean;
  scriptLink: string;
  sentAt?: string;
  note: string | null;
  reviewer: string | null;
}) {
  if (status === "IN_REVIEW") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-foreground/80">
          Your script is with a reviewer{sentAt ? ` (sent ${formatDistanceToNow(new Date(sentAt), { addSuffix: true })})` : ""}. Fill in the rest of the post
          while you wait.
        </p>
        <Button asChild size="sm" variant="outline" className="h-8 text-xs">
          <Link to={scriptLink}>View the script</Link>
        </Button>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onAddScript}>
              <FileText className="w-3.5 h-3.5" /> Replace the script
            </Button>
          )}
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link to={scriptLink}>View the script</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (status === "EDITS_PROPOSED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-foreground/80">
          <span className="font-semibold text-foreground">{reviewer ?? "Your reviewer"} edited your script.</span> Compare the two versions, then accept the
          changes or edit them.
        </p>
        <Button asChild size="sm" className="h-8 text-xs">
          <Link to={scriptLink}>Review the changes</Link>
        </Button>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onAddScript}>
              <FileText className="w-3.5 h-3.5" /> Replace the script
            </Button>
          )}
          <Button asChild size="sm" className="h-8 text-xs">
            <Link to={scriptLink}>Review the changes</Link>
          </Button>
        </div>
      </div>
    );
  }
  return <DraftBody stage={stage} submissionId={submissionId} reading={reading} onAddScript={onAddScript} canEdit={canEdit} scriptLink={scriptLink} status={status} note={note} reviewer={reviewer} />;
}

/** Not sent yet, or sent back with a note: upload (or replace) the script and send it. */
function DraftBody({
  stage,
  submissionId,
  reading,
  onAddScript,
  canEdit,
  scriptLink,
  status,
  note,
  reviewer,
}: {
  stage?: ScriptStage;
  submissionId: string | null;
  reading: boolean;
  onAddScript: () => void;
  canEdit: boolean;
  scriptLink: string;
  status: string;
  note: string | null;
  reviewer: string | null;
}) {
  const { submit } = useScriptActions(submissionId ?? "");
  const hasFile = Boolean(stage?.file_name);
  const failed = stage?.file_status === "FAILED";
  return (
    <div className="flex flex-col gap-2.5">
      {status === "CHANGES_REQUESTED" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">{reviewer ?? "Your reviewer"} asked for changes to the script</p>
          {note && <p className="text-[13px] text-amber-950 dark:text-amber-100">“{note}”</p>}
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
            Upload a new version, or{" "}
            <Link to={scriptLink} className="font-medium underline">
              edit it here
            </Link>
            .
          </p>
        </div>
      )}
      {!hasFile ? (
        <p className="text-[13px] text-foreground/80">
          Video posts start with the script. Upload it (PDF, Word or .txt) and send it for review. It's checked against the rulebook, and you can add the video
          once a reviewer approves it.
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-foreground/80">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-foreground">{stage?.file_name}</span>
          {reading ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading it...
            </span>
          ) : failed ? (
            <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" /> {stage?.file_error ?? "Couldn't read it. Try a .docx or PDF."}
            </span>
          ) : (
            <span className="text-emerald-700 dark:text-emerald-400">Ready to send</span>
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onAddScript} disabled={!canEdit}>
          <FileText className="w-3.5 h-3.5" /> {hasFile ? "Replace the script" : "Upload the script"}
        </Button>
        {hasFile && stage?.can_submit && (
          <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => submit.mutate()} disabled={reading || failed || submit.isPending}>
            {submit.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send script for review
          </Button>
        )}
      </div>
    </div>
  );
}
