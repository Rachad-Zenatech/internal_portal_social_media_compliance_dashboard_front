import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import CheckCoverage from "@/components/submissions/CheckCoverage";
import FlagReviewControl from "@/components/submissions/FlagReviewControl";
import { isVisibleFinding } from "@/lib/complianceFinding";
import { OtherFindings, statusOf } from "@/components/submissions/FindingStatus";
import ScoreBreakdown from "@/components/submissions/ScoreBreakdown";
import UnavailableCompliance from "@/components/submissions/UnavailableCompliance";
import SourceChecks from "@/components/submissions/SourceChecks";
import {
  AnalysisProgressPanel,
  UnderReviewBadge,
  isAnalysing,
} from "@/components/submissions/submissionUi";
import { useAuth } from "@/lib/AuthContext";
import type { Submission } from "@/types/submission";

/** A post's rulebook check: score, coverage, what it flagged, and (for reviewers) a call on each flag. */
export default function ComplianceView({
  sub,
  emptyText = "Not checked yet. The rulebook check runs when it's sent for review.",
  outdatedText = "The rulebook has changed since this check. It's checked again when it's next sent for review.",
}: {
  sub: Submission;
  emptyText?: string;
  outdatedText?: string;
}) {
  const { creatorView, user } = useAuth();
  const canReview = Boolean(sub.can_review) && !creatorView;
  // `creatorView` only covers super admins who switched modes. Regular creators need the same request action on posts they own.
  const canRequestDismissal = creatorView || sub.created_by === user?.id;
  const check = sub.latest_check;
  if (!check) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }
  if (check.ai_unavailable) return <UnavailableCompliance />;
  return (
    <div className="rounded-xl border border-border/70 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span className="flex items-center gap-1.5">
          {check.traffic_light === "RED" ? (
            <XCircle className="w-4 h-4 text-red-600" />
          ) : check.traffic_light === "YELLOW" ? (
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          )}
          {check.is_compliant
            ? "No issues found in the text"
            : check.violations_count > 0
            ? `${check.violations_count} potential issue${check.violations_count === 1 ? "" : "s"}`
            : "No rule breaches found; some things need a look"}
        </span>
        {isAnalysing(check) ? (
          <UnderReviewBadge progress={sub.analysis_progress} />
        ) : (
          <span className="tabular-nums">{check.score}/100</span>
        )}
      </div>
      {isAnalysing(check) && <AnalysisProgressPanel progress={sub.analysis_progress} />}
      <CheckCoverage check={check} />
      <SourceChecks checks={check.source_checks} savedChecks={sub.source_link_checks} submissionId={sub.id} />
      {sub.check_outdated && (
        <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          {sub.status === "APPROVED" || sub.status === "REJECTED"
            ? "Decided under an earlier version of the rulebook; rules have changed since."
            : outdatedText}
        </p>
      )}
      <ScoreBreakdown check={check} />
      <OtherFindings violations={check.violations} />
      {/* Creators can request a dismissal; a reviewer must approve it before the flag is cleared. */}
      {(canReview || canRequestDismissal) && check.violations.some((v) => v.rule_id && isVisibleFinding(v) && statusOf(v) !== "CLEARED") && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          {check.violations.filter((v) => isVisibleFinding(v) && statusOf(v) !== "CLEARED").map((v) => (
            <div key={v.rule_id} className="space-y-1 text-xs">
              <p className="font-semibold text-foreground">
                {v.rule_number} · {v.flagged_terms.map((t) => `"${t}"`).join(", ") || "missing disclaimer"}
              </p>
              <FlagReviewControl
                submissionId={sub.id}
                ruleId={v.rule_id}
                ruleNumber={v.rule_number}
                currentVersion={sub.current_version}
                canDismiss={canReview}
                canRequest={canRequestDismissal}
                evidence={v.status === "EVIDENCE_REQUIRED"}
              />
            </div>
          ))}
        </div>
      )}
      {/* Checks saved before penalties were recorded have no breakdown; list what they flagged. */}
      {!check.violations.some((v) => v.penalty != null) &&
        check.violations.filter((v) => statusOf(v) === "VIOLATION").map((v) => (
          <div key={v.rule_id} className="text-xs border-t border-border/60 pt-2.5">
            <p className="font-semibold text-foreground">
              {v.rule_number} · {v.title}
            </p>
            <p className="text-muted-foreground">Flagged: {v.flagged_terms.map((t) => `"${t}"`).join(", ")}</p>
          </div>
        ))}
    </div>
  );
}
