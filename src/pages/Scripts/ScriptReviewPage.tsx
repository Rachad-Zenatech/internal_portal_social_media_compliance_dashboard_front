import ScriptDocHub from "@/components/scriptdoc/ScriptDocHub";
import { useAuth } from "@/lib/AuthContext";

/**
 * Script review: start a blank script or attach one from a file, and filter scripts by scope and status.
 */
export default function ScriptReviewPage() {
  const { hasPermission, creatorView } = useAuth();
  const reviewer = hasPermission("CONTENT_REVIEW_VIEW") && !creatorView;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-8 min-[112.5rem]:max-w-[2200px]">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Script review</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {reviewer
            ? "Scripts sent for review. Open a script to review, comment, and approve."
            : "Start a blank script or attach a file. Each approved script becomes a post for you to film."}
        </p>
      </div>

      <ScriptDocHub />
    </div>
  );
}
