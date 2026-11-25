import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { CaptionComparison } from "./CaptionComparison";

export default function CaptionChangeDialog({ before, after, label = "Compare", description = "Review the previous and updated captions.", subject = "caption" }: {
  before: string; after: string; label?: string; description?: string; subject?: "caption" | "post text";
}) {
  const title = subject === "post text" ? "Post text changes" : "Caption changes";
  return (
    <Dialog>
      <DialogTrigger asChild><Button type="button" variant="outline" size="sm">{label}</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-6xl sm:p-6">
        <DialogHeader className="pr-6"><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <CaptionComparison before={before} after={after} subject={subject} />
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
