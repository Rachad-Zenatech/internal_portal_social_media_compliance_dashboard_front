import { useState } from "react";
import { Loader2, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * The three dots on a script (or a document of scripts) with a Delete script action. Only drafts get it: once a script has
 * been sent for review it can't be deleted, so callers leave this out for anything else.
 */
export default function DeleteScriptMenu({
  name,
  what = "script",
  onDelete,
  className,
}: {
  name: string;
  what?: string;
  onDelete: () => Promise<void>;
  className?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await onDelete();
      setConfirm(false);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Couldn't delete it");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`More actions for ${name}`}
            className={cn("grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground", className)}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2 className="h-4 w-4" />
            Delete script
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={(o) => !busy && setConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {what}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{name}” and everything written in it will be deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={remove}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Delete script
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
