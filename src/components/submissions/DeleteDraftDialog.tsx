import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";

export interface DeleteDraftTarget {
  id: string;
  reference_code: string;
  title: string;
  current_version: number;
  created_by?: string | null;
  created_by_name?: string | null;
}

/**
 * Confirm and delete a draft. Says what actually happens: a never-submitted draft is removed with its files;
 * one that was reviewed before is taken off the portal but its review history is kept. When someone deletes
 * another person's draft, that person is told (the backend sends them a notification).
 */
export default function DeleteDraftDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: DeleteDraftTarget | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOwn = !target?.created_by || target.created_by === user?.id;

  const remove = useMutation({
    mutationFn: (t: DeleteDraftTarget) => submissionService.deleteDraft(t.id),
    onSuccess: (_, t) => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.removeQueries({ queryKey: ["submission", t.id] });
      queryClient.removeQueries({ queryKey: ["submission-history", t.id] });
      toast.success(`${t.reference_code} deleted.`);
      onDeleted?.();
    },
    onError: (err: Error, t) => toast.error(`Couldn't delete ${t.reference_code}: ${err.message}`),
  });

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base text-red-600">
            <Trash2 className="w-4 h-4" /> Delete draft {target?.reference_code}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs space-y-2">
            <span className="block">
              <strong className="text-foreground">{target?.title}</strong>{" "}
              {target && target.current_version > 0
                ? "is removed from the Content Portal. It was reviewed before, so its versions, review history and activity are kept on record."
                : "and its uploaded files are removed. This can't be undone."}
            </span>
            {!isOwn && (
              <span className="block">
                This draft belongs to {target?.created_by_name || "someone else"}. They'll get a notification that you deleted it.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="text-xs gap-1 bg-red-600 hover:bg-red-700 text-white"
            disabled={remove.isPending}
            onClick={() => {
              if (!target) return;
              remove.mutate(target);
              onClose();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
