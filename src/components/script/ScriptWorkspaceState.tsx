import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Loading, error and empty states shared by the script review workspace. */
export default function ScriptWorkspaceState({ loading, error, onUploadScript }: {
  loading: boolean; error?: string; onUploadScript?: () => void;
}) {
  if (error) return <div role="alert" className="grid flex-1 place-items-center p-10 text-sm text-muted-foreground">Couldn't load the script: {error}</div>;
  if (loading) return <div role="status" className="grid flex-1 place-items-center p-10 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>;
  return (
    <div className="grid flex-1 place-items-center p-10 text-center">
      <div className="max-w-md space-y-3">
        <FileText className="mx-auto size-10 text-blue-600/70" />
        <p className="text-base font-semibold text-foreground">This post has no script yet.</p>
        <p className="text-xs text-muted-foreground">Upload the script to start the compliance check.</p>
        {onUploadScript && <Button type="button" size="sm" className="mt-2 h-8 gap-1.5 bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800" onClick={onUploadScript}><FileText className="size-3.5" />Upload the script</Button>}
      </div>
    </div>
  );
}
