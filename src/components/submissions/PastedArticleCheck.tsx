import { useState } from "react";
import { ClipboardPaste, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import SourceCheckResult from "@/components/submissions/SourceCheckResult";
import { submissionService } from "@/services/submissionService";
import type { SourceLinkCheck } from "@/types/sourceLink";

/** The server needs at least this much text to check against (a whole article, not a sentence). */
const MIN_CHARS = 200;
const MAX_CHARS = 250000;
const FIELD = "w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

interface Props {
  submissionId: string | null;
  ensureSubmissionId: () => Promise<string | null>;
}

function PasteForm(props: {
  text: string; title: string; url: string; busy: boolean;
  onText: (v: string) => void; onTitle: (v: string) => void; onUrl: (v: string) => void;
  onCheck: () => void; onClose: () => void;
}) {
  const short = props.text.trim().length < MIN_CHARS;
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/60 p-2.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Paste the whole article. Each claim in the post is looked for in it.</span>
        <button type="button" onClick={props.onClose} aria-label="Close" className="rounded p-0.5 hover:bg-muted">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        value={props.text}
        onChange={(e) => props.onText(e.target.value.slice(0, MAX_CHARS))}
        rows={7}
        placeholder="Paste the article's full text here..."
        className={FIELD}
      />
      <div className="flex flex-wrap gap-2">
        <input value={props.title} onChange={(e) => props.onTitle(e.target.value)} placeholder="Title (optional)" className={`${FIELD} min-w-[160px] flex-1`} />
        <input value={props.url} onChange={(e) => props.onUrl(e.target.value)} placeholder="Copied from (URL, optional)" className={`${FIELD} min-w-[160px] flex-1`} />
        <button
          type="button"
          onClick={props.onCheck}
          disabled={short || props.busy}
          title={short ? `Paste at least ${MIN_CHARS} characters` : undefined}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {props.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {props.busy ? "Checking..." : "Check against article"}
        </button>
      </div>
    </div>
  );
}

/** Check the post against an article pasted in whole: for pages the checker can't open, or a copy someone has. */
export default function PastedArticleCheck({ submissionId, ensureSubmissionId }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SourceLinkCheck | null>(null);

  const runCheck = async () => {
    setBusy(true);
    try {
      const id = submissionId ?? (await ensureSubmissionId());
      if (!id) return;
      const payload = { text, title: title.trim() || undefined, url: url.trim() || undefined };
      setResult(await submissionService.checkPastedSource(id, payload));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check the pasted article.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      >
        <ClipboardPaste className="h-3.5 w-3.5 text-primary" /> Paste article text
      </button>
    );
  }
  return (
    <div>
      <PasteForm
        text={text} title={title} url={url} busy={busy}
        onText={setText} onTitle={setTitle} onUrl={setUrl}
        onCheck={() => void runCheck()} onClose={() => setOpen(false)}
      />
      {result && <SourceCheckResult result={result} />}
    </div>
  );
}
