import { Link } from "react-router-dom";
import { ArrowLeft, CheckCheck, Send, ShieldCheck, Wifi, WifiOff } from "lucide-react";

import { DocDetailsButton } from "@/components/scriptdoc/DocDetailsPanel";
import { Dot } from "@/components/scriptdoc/ReviewDialogs";
import { Button } from "@/components/ui/button";
import type { LiveStatus } from "@/lib/scriptDocLive";
import type { DocDetail, DocStatus, Vote } from "@/types/scriptDoc";

export const DOC_STATUS: Record<DocStatus, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "bg-muted text-muted-foreground" },
  IN_REVIEW: { label: "In review", tone: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  LEVEL2_REVIEW: { label: "Level 2 approval", tone: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  APPROVED: { label: "Approved", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

export interface HeaderActions {
  onDetails: () => void;
  onSend: () => void;
  onFinish: () => void;
  onUndoCheckIn: () => void;
  onDecideNext: () => void;
  onDecision: () => void;
}

/** What the viewer can do next, as buttons: details, send, finish my review, decide. */
function HeaderButtons({ doc, myCheckIn, sendHint, actions }: { doc: DocDetail; myCheckIn: Vote | null; sendHint?: string; actions: HeaderActions }) {
  const { access } = doc;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DocDetailsButton doc={doc} onClick={actions.onDetails} />
      {access.can_submit && (
        <Button size="sm" disabled={Boolean(sendHint)} title={sendHint} onClick={actions.onSend}>
          <Send className="mr-1.5 h-4 w-4" />
          {doc.status === "CHANGES_REQUESTED" ? "Send again" : "Send for review"}
        </Button>
      )}
      {access.can_check_in && doc.status === "IN_REVIEW" && (
        <Button size="sm" variant={myCheckIn ? "outline" : "default"} onClick={myCheckIn ? actions.onUndoCheckIn : actions.onFinish}>
          <CheckCheck className={`mr-1.5 h-4 w-4 ${myCheckIn ? "text-emerald-600" : ""}`} />
          {myCheckIn ? "Checked in · undo" : "Finish my review"}
        </Button>
      )}
      {doc.all_checked && access.can_finalize && doc.status === "IN_REVIEW" && (
        <Button size="sm" onClick={actions.onDecideNext}>
          <ShieldCheck className="mr-1.5 h-4 w-4" />
          Decide next step
        </Button>
      )}
      {access.can_decide && (
        <Button size="sm" variant={doc.status === "LEVEL2_REVIEW" ? "default" : "outline"} onClick={actions.onDecision}>
          {doc.status === "LEVEL2_REVIEW" ? "Level 2 decision" : "Final decision"}
        </Button>
      )}
    </div>
  );
}

/** Who has the script open right now, and whether the live connection is up. */
function Presence({ live, people }: { live: LiveStatus; people: { id: string; name: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="People here now">
      {people.map((u) => (
        <span
          key={u.id}
          title={u.name}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-background"
          style={{ background: u.color }}
        >
          {u.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      <span className={`flex items-center gap-1 text-xs ${live === "live" ? "text-emerald-600" : "text-muted-foreground"}`}>
        {live === "live" ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {live === "live" ? "Live" : live === "connecting" ? "Connecting" : "Reconnecting"}
      </span>
    </div>
  );
}

/** What this is and where it stands on the left; who is here and what to do next on the right. */
export default function DocHeader({
  doc,
  live,
  people,
  myCheckIn,
  sendHint,
  actions,
}: {
  doc: DocDetail;
  live: LiveStatus;
  people: { id: string; name: string; color: string }[];
  myCheckIn: Vote | null;
  sendHint?: string;
  actions: HeaderActions;
}) {
  const st = DOC_STATUS[doc.status];
  const role = doc.access.role;
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-4 py-3">
      <Link to="/script-review" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Back to scripts">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1 basis-60">
        <h1 className="truncate text-lg font-semibold leading-tight">{doc.title}</h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className={`rounded-full px-2 py-0.5 font-medium ${st.tone}`}>{st.label}</span>
          <span>by {doc.creator_name}</span>
          <span>· round {Math.max(doc.round, 1)}</span>
          {role !== "CREATOR" && <span>· you are {role === "VIEWER" ? "viewing and adding notes" : role.toLowerCase()}</span>}
        </p>
      </div>
      <Presence live={live} people={people} />
      <HeaderButtons doc={doc} myCheckIn={myCheckIn} sendHint={sendHint} actions={actions} />
    </header>
  );
}

/** One slim strip that says what is going on and what is needed. */
export function DocStatusStrip({ doc, myCheckIn, changedBy }: { doc: DocDetail; myCheckIn: Vote | null; changedBy: string | null }) {
  const required = doc.reviewers.filter((r) => r.capacity === "EDIT");
  const checked = required.filter((r) => r.checked_in).length;
  const posts = doc.posts.filter((p) => p.submission_id);
  if (doc.status === "IN_REVIEW") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-blue-50/70 px-4 py-2 text-xs dark:bg-blue-500/5">
        <span className="font-medium">
          {checked} of {required.length} reviewers have checked in
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {required.map((r) => (
            <span key={r.user_id} className="flex items-center gap-1" title={r.checked_in ? `${r.name} checked in` : `${r.name} is still working`}>
              <Dot color={r.color} className={r.checked_in ? "" : "opacity-30"} />
              <span className={r.checked_in ? "" : "text-muted-foreground"}>{r.name}</span>
            </span>
          ))}
        </span>
        {changedBy && !myCheckIn && doc.access.can_check_in && <span className="ml-auto text-amber-700 dark:text-amber-300">{changedBy} changed the script</span>}
      </div>
    );
  }
  if (doc.status === "LEVEL2_REVIEW") {
    return (
      <div className="border-b bg-violet-50/70 px-4 py-2 text-xs dark:bg-violet-500/5">
        Waiting for the Content Manager's level 2 decision.{doc.decision_note ? ` Note: ${doc.decision_note}` : ""}
      </div>
    );
  }
  if (doc.status === "CHANGES_REQUESTED") {
    return (
      <div className="border-b bg-amber-50 px-4 py-2 text-xs dark:bg-amber-500/10">
        Changes requested{doc.decided_by_name ? ` by ${doc.decided_by_name}` : ""}: {doc.decision_note ?? "see the notes"}.
        {doc.access.can_submit && " Edit the script, then send it again."}
      </div>
    );
  }
  if (doc.status === "APPROVED") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-emerald-50 px-4 py-2 text-xs dark:bg-emerald-500/10">
        <span>
          Approved{doc.decided_by_name ? ` by ${doc.decided_by_name}` : ""}.{doc.decision_note ? ` ${doc.decision_note}` : ""}
        </span>
        {posts.map((p) => (
          <Link key={p.position} to={`/submissions/${p.submission_id}`} className="font-medium text-emerald-800 underline dark:text-emerald-300">
            Attach the video
          </Link>
        ))}
      </div>
    );
  }
  return null;
}
