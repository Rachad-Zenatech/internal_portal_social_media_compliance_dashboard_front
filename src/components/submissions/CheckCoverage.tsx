import { useState } from "react";
import { ChevronDown, Eye, Hash, Info, Loader2, UserCheck } from "lucide-react";

import type { StoredCheck } from "@/types/submission";

/**
 * What the rulebook check actually covered: which parts of the post it read, and which applicable rules it can't
 * test from text at all, so a clean score isn't mistaken for "every rule passed".
 */
export default function CheckCoverage({ check, className = "" }: { check: StoredCheck; className?: string }) {
  const [open, setOpen] = useState(false);
  const manual = check.manual_review_rules ?? [];
  const total = check.rules_checked ?? 0;
  const images = check.images_total ?? 0;
  const read = check.images_read ?? 0;
  const pending = check.images_pending ?? 0;
  const failed = check.images_failed ?? 0;

  const docsPending = check.documents_pending ?? 0;
  const docsFailed = check.documents_failed ?? [];

  const sources = ["title", "caption"];
  if (check.includes_script) sources.push("script");
  else if ((check.documents_read ?? 0) > 0) sources.push("article");
  if (check.includes_transcript) sources.push("video transcript");
  if (read > 0) sources.push(`text in ${read === images ? (images === 1 ? "its image" : `all ${images} images`) : `${read} of ${images} images`}`);

  // Cashtags, hashtags, mentions and links the check picked out of the post.
  const signals = check.signals;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const picked: string[] = [];
  if (signals?.cashtags.length) picked.push(signals.cashtags.join(" "));
  if (signals?.hashtags.length) picked.push(plural(signals.hashtags.length, "hashtag"));
  if (signals?.mentions.length) picked.push(signals.mentions.join(" "));
  if (signals?.links.length) picked.push(plural(signals.links.length, "link"));

  return (
    <div className={`space-y-1 text-[11px] text-muted-foreground ${className}`}>
      <p className="flex items-start gap-1.5">
        <Eye className="mt-px w-3.5 h-3.5 shrink-0" />
        <span>
          Read: {sources.join(", ")}.
          {check.transcript_pending && " The video transcript is still being made; the score updates when it's ready."}
        </span>
      </p>
      {picked.length > 0 && (
        <p className="flex items-start gap-1.5">
          <Hash className="mt-px w-3.5 h-3.5 shrink-0" />
          <span>Picked out: {picked.join(" · ")}.</span>
        </p>
      )}
      {signals?.notes.map((note) => (
        <p key={note} className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
          <Info className="mt-px w-3.5 h-3.5 shrink-0" />
          <span>{note}</span>
        </p>
      ))}
      {docsPending > 0 && (
        <p className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          Reading the script; the score updates when it's done.
        </p>
      )}
      {docsFailed.map((d) => (
        <p key={d.name} className="text-amber-700 dark:text-amber-300">
          {d.name} wasn't checked: {d.error ?? "its text couldn't be read."}
        </p>
      ))}
      {pending > 0 && (
        <p className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          Reading the text in {pending} image{pending === 1 ? "" : "s"}; the score updates when it's done.
        </p>
      )}
      {failed > 0 && (
        <p className="text-amber-700 dark:text-amber-300">
          The text in {failed} image{failed === 1 ? "" : "s"} couldn't be read, so it wasn't checked. Check it by eye.
        </p>
      )}
      {total > 0 && manual.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-start gap-1.5 text-left hover:text-foreground"
          >
            <UserCheck className="mt-px w-3.5 h-3.5 shrink-0" />
            <span>
              {total - manual.length} of {total} rules checked automatically ·{" "}
              <span className="font-semibold text-foreground">
                {manual.length} need{manual.length === 1 ? "s" : ""} a reviewer
              </span>
            </span>
            <ChevronDown className={`mt-px w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <ul className="mt-1 ml-5 space-y-0.5">
              {manual.map((m) => (
                <li key={m.rule_id}>
                  <span className="font-semibold text-foreground">{m.rule_number}</span> · {m.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
