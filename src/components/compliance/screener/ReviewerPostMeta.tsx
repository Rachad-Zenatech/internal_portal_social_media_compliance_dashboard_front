import type { ReactNode } from "react";
import { Clock3 } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import PlatformIcon, { type SocialPlatform } from "@/components/video/PlatformIcon";

interface Props {
  platforms: { code: string; label: string }[];
  handle?: string | null;
  brand?: string | null;
  audience?: string | null;
  deadline: Date | null;
  inReview: boolean;
}

/** Separate publishing details from the approval deadline so both are easy to scan. */
export default function ReviewerPostMeta({ platforms, handle, brand, audience, deadline, inReview }: Props) {
  const accounts = platforms.map((platform, index) => (
    <span key={platform.code} className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <PlatformIcon platform={platform.code as SocialPlatform} className="size-3.5 shrink-0" />
      <span>{platform.label}</span>
      {index === 0 && handle && <span className="break-all font-normal text-muted-foreground">@{handle.replace(/^@/, "")}</span>}
    </span>
  ));
  return (
    <div className="@container/reviewer-meta mt-1 border-t border-border/60 pt-3">
      <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-3 @[24rem]/reviewer-meta:grid-cols-2">
        <MetaField label={platforms.length > 1 ? "Platforms" : "Platform"}><div className="flex flex-col gap-1.5">{accounts}</div></MetaField>
        {brand && <MetaField label="Brand">{brand}</MetaField>}
        {audience && <MetaField label="Audience">{audience}</MetaField>}
        {deadline && !Number.isNaN(deadline.getTime()) && <MetaField label="Approval deadline"><ApprovalDeadline date={deadline} inReview={inReview} /></MetaField>}
      </dl>
    </div>
  );
}

function MetaField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words text-[13px] font-medium leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}

function ApprovalDeadline({ date, inReview }: { date: Date; inReview: boolean }) {
  const overdue = inReview && isPast(date);
  const tone = overdue ? "text-red-700 dark:text-red-300"
    : "text-foreground";
  const dateLabel = format(date, "MMM d, h:mm a");
  const fullDate = format(date, "EEEE, MMMM d, yyyy 'at' h:mm a");
  return (
    <div className={`flex min-w-0 items-start gap-1.5 ${tone}`}>
      <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5 text-xs leading-relaxed">
        <time dateTime={date.toISOString()} title={fullDate} className="whitespace-nowrap font-semibold">{dateLabel}</time>
        {overdue && <span className="text-[11px]">Overdue by {formatDistanceToNow(date)}</span>}
      </div>
    </div>
  );
}
