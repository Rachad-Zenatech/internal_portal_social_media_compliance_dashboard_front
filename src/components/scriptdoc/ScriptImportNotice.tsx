import { AlertTriangle } from "lucide-react";

export default function ScriptImportNotice({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  const notices = messages.map((message) => <p key={message}>{message}</p>);
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">Imported document format</p>
        {notices}
      </div>
    </div>
  );
}
