import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ContextEntry } from "@/types/context";

/** Asks before removing an entry, and points to turning it off instead. */
export default function RemoveEntryDialog({
  entry,
  removing,
  onRemove,
  onClose,
}: {
  entry: ContextEntry | null;
  removing: boolean;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={entry !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Remove "{entry?.title}"?</DialogTitle>
          <DialogDescription className="text-xs">The analysis stops using it. To pause it instead, turn it off.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" className="text-xs gap-1.5" disabled={removing} onClick={() => entry && onRemove(entry.id)}>
            {removing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
