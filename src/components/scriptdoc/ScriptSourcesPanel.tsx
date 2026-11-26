import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import SourceChecks from "@/components/submissions/SourceChecks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { scriptSourceEntries } from "@/lib/scriptSources";
import { scriptDocService } from "@/services/scriptDocService";
import type { DocDetail } from "@/types/scriptDoc";
import type { StoredCheck } from "@/types/submission";

function SourceEntry({ entry }: { entry: ReturnType<typeof scriptSourceEntries>[number] }) {
  return (
    <li className="space-y-2 rounded-md border p-3 text-xs">
      <p className="whitespace-pre-wrap break-words">{entry.text}</p>
      {entry.urls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-blue-600 underline dark:text-blue-300">{url}</a>)}
    </li>
  );
}

export default function ScriptSourcesPanel({ doc, draft, dirty, saving, onChange, onSave, onReset, check, running, onRun }: {
  doc: DocDetail; draft: string; dirty: boolean; saving: boolean;
  onChange: (value: string) => void; onSave: () => void; onReset: () => void;
  check: StoredCheck | null; running: boolean; onRun: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const entries = scriptSourceEntries(doc.sources_text ?? "");
  const canEdit = doc.access.can_edit && ["DRAFT", "CHANGES_REQUESTED", "IN_REVIEW", "LEVEL2_REVIEW"].includes(doc.status);
  const download = async () => {
    setDownloading(true);
    try { await scriptDocService.download(doc.id, `${doc.title}.docx`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't download script"); }
    finally { setDownloading(false); }
  };
  return (
    <section className="space-y-4 p-3" aria-label="Script sources">
      <div><h2 className="text-sm font-semibold">Sources</h2><p className="mt-1 text-xs text-muted-foreground">Evidence for this script’s claims. Compliance checks read these sources separately from the script.</p></div>
      {canEdit && <div className="space-y-2">
        <label htmlFor={`sources-${doc.id}`} className="text-xs font-medium">Source names, links and supporting notes</label>
        <Textarea id={`sources-${doc.id}`} value={draft} onChange={(event) => onChange(event.target.value)} rows={8} disabled={saving} placeholder="One source per line: name — https://… — what it supports" />
        <div className="flex gap-2"><Button size="sm" onClick={onSave} disabled={!dirty || saving}>{saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Save sources</Button><Button size="sm" variant="ghost" disabled={!dirty || saving} onClick={onReset}>Cancel</Button></div>
      </div>}
      {entries.length ? <ul className="space-y-2">{entries.map((entry, index) => <SourceEntry key={index} entry={entry} />)}</ul> : <p className="text-xs text-muted-foreground">No sources attached to this script yet.</p>}
      {dirty && <p className="text-xs text-amber-700 dark:text-amber-300">Save sources before running compliance or downloading.</p>}
      <Button size="sm" className="w-full" disabled={dirty || saving || running} onClick={onRun}>{running && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Check script against sources</Button>
      <p className="text-xs text-muted-foreground">Checks verify support for claims. An attached link alone does not verify a claim; unavailable sources remain unresolved.</p>
      {check?.source_checks?.length ? <SourceChecks checks={check.source_checks} creator={doc.access.role === "CREATOR"} /> : <p className="text-xs text-muted-foreground">Source verification results appear here after the compliance check.</p>}
      <Button size="sm" variant="outline" disabled={dirty || saving || downloading} onClick={() => void download()}><Download className="mr-1.5 h-3.5 w-3.5" />Download script with sources</Button>
    </section>
  );
}
