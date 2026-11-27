import { Check, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DelegateReviewButton } from "@/components/submissions/DelegateReview";
import type { ReviewTarget } from "@/components/submissions/ReviewDecisionPanel";

export default function ReviewDecisionBar({ target, mayApprove, onStart }: {
  target: ReviewTarget;
  mayApprove: boolean;
  onStart: (mode: "schedule" | "changes") => void;
}) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-2 @[22rem]:grid-cols-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" className="h-10 gap-2 text-[13px] font-semibold" onClick={() => onStart("changes")}>
              <MessageSquareWarning className="size-4" /> Request changes
            </Button>
          </TooltipTrigger>
          <TooltipContent>Record requested changes. The post stays with reviewers until the Get approval by deadline.</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex" tabIndex={mayApprove ? undefined : 0}>
              <Button className="h-10 w-full gap-2 text-[13px] font-semibold" onClick={() => onStart("schedule")} disabled={!mayApprove}>
                <Check className="size-4" /> Approve content
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Approve with suggestions. The creator reviews feedback, updates the post and reruns checks before publishing.</TooltipContent>
        </Tooltip>
        {target.can_delegate && <DelegateReviewButton target={target} className="h-8 justify-self-end border-transparent bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-muted @[22rem]:col-span-2" />}
      </div>
    </div>
  );
}
