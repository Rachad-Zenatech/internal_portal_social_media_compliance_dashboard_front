import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scriptDocService } from "@/services/scriptDocService";

/** Opening a submitted upload explicitly adopts it into the shared review workflow. */
export function OpenSharedScriptReview({ submissionId, documentId }: { submissionId: string; documentId?: string | null }) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["script-document-import", submissionId],
    queryFn: async () => {
      const result = await scriptDocService.fromSubmission(submissionId);
      await cache.invalidateQueries({ queryKey: ["script-docs"] });
      await cache.invalidateQueries({ queryKey: ["script", submissionId] });
      return result;
    },
    enabled: !documentId,
    retry: false,
    staleTime: Infinity,
  });
  const id = documentId || query.data?.document_id;
  if (id) return <Navigate to={`/script-docs/${id}`} replace />;
  if (query.isSuccess && !id) return <ImportError message="Shared-document review is currently disabled." onRetry={() => void query.refetch()} />;
  if (query.isError) return <ImportError message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  return <div className="grid flex-1 place-items-center p-10 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Opening shared script review...</div>;
}

function ImportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="space-y-3 p-6 text-sm"><p role="alert">Could not open shared script review: {message}</p><Button onClick={onRetry}>Try again</Button></div>;
}

export function SharedScriptReviewLink({ submissionId, documentId }: { submissionId: string; documentId?: string | null }) {
  const href = documentId ? `/script-docs/${documentId}` : `/script-review/scripts/${submissionId}`;
  return <div className="space-y-3 rounded-xl border bg-card p-5 text-sm"><p>This script uses shared-document review. Open it to edit together, check in, or view the decision.</p><Button asChild><Link to={href}>Open script document</Link></Button></div>;
}
