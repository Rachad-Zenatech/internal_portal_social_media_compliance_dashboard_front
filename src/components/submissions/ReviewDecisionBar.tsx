import { Check, FilePen, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DelegateReviewButton } from "@/components/submissions/DelegateReview";
import type { ReviewTarget } from "@/components/submissions/ReviewDecisionPanel";

export default function ReviewDecisionBar({ target, mayApprove, onStart }: {
  target: ReviewTarget;
  mayApprove: boolean;
  onStart: (mode: "schedule" | "changes" | "changes_publish") => void;
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
          <TooltipContent>Send the post back for changes and another review.</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex" tabIndex={mayApprove ? undefined : 0}>
              <Button variant="outline" className="h-10 w-full gap-2 text-[13px] font-semibold" onClick={() => onStart("schedule")} disabled={!mayApprove}>
                <Check className="size-4" /> Approve content
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Approve this version so the creator can publish it.</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button className="h-auto min-h-10 gap-2 whitespace-normal text-[13px] font-semibold @[22rem]:col-span-2" onClick={() => onStart("changes_publish")}>
              <FilePen className="size-4" /> Send back &amp; allow publishing
            </Button>
          </TooltipTrigger>
          <TooltipContent>Let the creator publish after making your requested changes.</TooltipContent>
        </Tooltip>
        {target.can_delegate && <DelegateReviewButton target={target} className="h-8 justify-self-end border-transparent bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-muted @[22rem]:col-span-2" />}
      </div>
    </div>
  );
}
