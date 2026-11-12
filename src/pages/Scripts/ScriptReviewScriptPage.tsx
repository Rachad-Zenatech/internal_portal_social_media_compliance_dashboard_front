import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import ScriptReviewWorkspace from "@/components/script/ScriptReviewWorkspace";
import { useAuth } from "@/lib/AuthContext";

/**
 * One video script, reviewed in the Script review section: the script marked up beside its flags, highlights,
 * sentiment and history, and the decision. A script from a batch has the batch's strip across the top to step
 * between its scripts.
 */
export default function ScriptReviewScriptPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission, creatorView } = useAuth();
  const isReviewer = hasPermission("CONTENT_REVIEW_VIEW") && !creatorView;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 min-[112.5rem]:max-w-[2200px]">
      <Link
        to="/script-review"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Script review
      </Link>
      <div className="flex min-h-[640px] flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:h-[calc(100dvh-12rem)]">
        {id && (
          <ScriptReviewWorkspace
            key={id}
            submissionId={id}
            isReviewer={isReviewer}
            onOpenScript={(next) => navigate(`/script-review/scripts/${next}`)}
          />
        )}
      </div>
    </div>
  );
}
