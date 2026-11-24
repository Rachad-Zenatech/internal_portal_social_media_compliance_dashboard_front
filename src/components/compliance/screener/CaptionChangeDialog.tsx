import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { CaptionComparison } from "./CaptionComparison";

export default function CaptionChangeDialog({ before, after, label = "Compare", description = "Review the previous and updated captions." }: {
  before: string; after: string; label?: string; description?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button type="button" variant="outline" size="sm">{label}</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-6xl sm:p-6">
        <DialogHeader className="pr-6"><DialogTitle>Caption changes</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <CaptionComparison before={before} after={after} />
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
