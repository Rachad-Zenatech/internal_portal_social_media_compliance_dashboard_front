import { format } from "date-fns";
import { Ban, CopyCheck, Info } from "lucide-react";

import type { DuplicateMatch, DuplicateReport } from "@/types/submission";

const day = (iso?: string | null) => (iso ? format(new Date(iso), "MMM d, yyyy") : "no date");

/** "SUB-12 · Launch post (in review, sent Nov 3, 2026)" */
function Ref({ m }: { m: DuplicateMatch }) {
  return (
    <span>
      <span className="font-semibold text-foreground">{m.reference_code}</span> · {m.title}
      <span className="text-muted-foreground">
        {" "}
        ({m.status.replace(/_/g, " ").toLowerCase()}
        {m.submitted_at ? `, sent ${day(m.submitted_at)}` : ""}
        {m.created_by_name ? ` by ${m.created_by_name}` : ""})
      </span>
    </span>
  );
}

/** Each dropdown: what both posts share, and what only this post adds. */
function Details({ m }: { m: DuplicateMatch }) {
  return (
    <ul className="mt-1.5 space-y-0.5">
      {m.details.map((d) => (
        <li key={d.field} className="grid grid-cols-[9.5rem_1fr] gap-2">
          <span className="text-muted-foreground">{d.label}</span>
          <span>
            {d.shared.length ? (
              <span className="font-medium text-foreground">Same: {d.shared.join(", ")}</span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-300">Different</span>
            )}
            {d.new.length > 0 && (
              <span className="text-emerald-700 dark:text-emerald-300">
                {d.shared.length ? " · " : ": "}new {d.new.join(", ")}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Posts already sent for approval with the same content and caption as this one. Blocked: one overlaps on every
 * Submission Details dropdown and the publish date. Repost: the same, on another date (the creator confirms on send).
 * Otherwise the same post is going somewhere new, which is fine; the overlap is listed so the creator knows.
 */
export default function DuplicateNotice({ report, publishAt }: { report: DuplicateReport; publishAt?: Date | null }) {
  if (!report.matches.length) return null;
  const others = report.matches.filter((m) => m !== report.blocking && m.submission_id !== report.blocking?.submission_id
    && m.submission_id !== report.repost?.submission_id);
  return (
    <div className="space-y-2 text-xs">
      {report.blocking && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          <p className="flex items-start gap-1.5 font-semibold">
            <Ban className="mt-px h-3.5 w-3.5 shrink-0" />
            Duplicate post: it can't be sent for review.
          </p>
          <p className="mt-1">
            The same post and caption were already sent for approval as <Ref m={report.blocking} />, for the same
            publish date ({day(report.blocking.publish_at)}) and these submission details:
          </p>
          <Details m={report.blocking} />
          <p className="mt-1.5 font-medium">
            Change the brand, account, audience, region or platform so at least one no longer overlaps (for example, a
            platform it wasn't sent to).
          </p>
        </div>
      )}
      {!report.blocking && report.repost && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="flex items-start gap-1.5 font-semibold">
            <CopyCheck className="mt-px h-3.5 w-3.5 shrink-0" />
            Same post, new date
          </p>
          <p className="mt-1">
            This post was already sent for approval as <Ref m={report.repost} /> for {day(report.repost.publish_at)}.
            Everything but the date is the same. You'll be asked to confirm sending it again for{" "}
            {publishAt ? format(publishAt, "MMM d, yyyy") : "no date"}.
          </p>
        </div>
      )}
      {others.map((m) => (
        <div key={m.submission_id} className="rounded-lg border border-border/80 bg-muted/30 p-3">
          <p className="flex items-start gap-1.5">
            <Info className="mt-px h-3.5 w-3.5 shrink-0 text-blue-600" />
            <span>
              The same post and caption were already sent for approval as <Ref m={m} />. This one goes somewhere new,
              so it can be sent:
            </span>
          </p>
          <Details m={m} />
        </div>
      ))}
    </div>
  );
}
