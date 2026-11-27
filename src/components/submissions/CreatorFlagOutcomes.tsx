import { useFlagOutcomes } from "@/hooks/useFlagOutcomes";
import type { FlagOutcome } from "@/types/flagOutcome";

const labels = {
  DISMISSED: "Flag dismissed by reviewer",
  APPROVED: "Your dismissal request was accepted",
  REJECTED: "Your dismissal request was declined",
};

export function FlagOutcomeRow({ item, currentVersion }: { item: FlagOutcome; currentVersion: number }) {
  const declined = item.outcome === "REJECTED";
  const tone = declined ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950";
  const version = item.version_number === currentVersion ? "Current version" : `Version ${item.version_number}`;
  return (
    <li className={`rounded-lg border p-3 text-sm dark:bg-muted dark:text-foreground ${tone}`}>
      <p className="font-semibold">{item.rule_number}: {labels[item.outcome]}</p>
      <p className="mt-1 text-xs">{item.reviewer_name ?? "A reviewer"}{" - "}{version}</p>
      <p className="mt-2"><strong>Reason:</strong> {item.reason}</p>
      {item.note && <p className="mt-1 whitespace-pre-wrap"><strong>Reviewer note:</strong> {item.note}</p>}
      {declined && <p className="mt-2">Please address this concern before sending the post back.</p>}
    </li>
  );
}

export default function CreatorFlagOutcomes({ submissionId, currentVersion }: { submissionId: string; currentVersion: number }) {
  const { data, isPending, isError, refetch } = useFlagOutcomes(submissionId, currentVersion > 0);
  if (currentVersion < 1) return null;
  if (isPending) return <p className="text-xs text-muted-foreground" role="status">Loading reviewer decisions...</p>;
  if (isError) return <p role="alert" className="text-sm">Reviewer decisions could not be loaded. <button type="button" className="underline" onClick={() => refetch()}>Try again</button></p>;
  if (!data?.length) return null;
  return (
    <section aria-label="Reviewer decisions" className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-bold">Reviewer decisions</h2>
      <p className="text-xs text-muted-foreground">Decisions are kept with the version that was reviewed. They do not automatically clear flags after you change the post.</p>
      <ul className="space-y-2">{data.map((item) => <FlagOutcomeRow key={`${item.version_number}-${item.rule_id}-${item.outcome}`} item={item} currentVersion={currentVersion} />)}</ul>
    </section>
  );
}

/** The saved decision stays visible even when the finding is collapsed or read-only. */
export function InlineFlagOutcome({ submissionId, ruleId, currentVersion }: {
  submissionId: string; ruleId: string; currentVersion: number;
}) {
  const { data } = useFlagOutcomes(submissionId, currentVersion > 0);
  if (currentVersion < 1) return null;
  const item = data?.find((decision) => decision.rule_id === ruleId && decision.version_number === currentVersion);
  if (!item) return null;
  return <ul aria-label="Reviewer decision for this flag" className="px-4 pb-4"><FlagOutcomeRow item={item} currentVersion={currentVersion} /></ul>;
}
