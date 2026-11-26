import { Button } from "@/components/ui/button";

type CheckStep = "compliance" | "sentiment";

/** Explain the remaining checks instead of silently disabling publication. */
export default function RevisionCheckRequirements({ required, onOpen, busy }: {
  required: CheckStep[];
  onOpen?: (step: CheckStep) => void;
  busy: boolean;
}) {
  if (!required.length) return null;
  const actions = required.map(step => <Button key={step} type="button" size="sm" variant="outline" disabled={busy} onClick={() => onOpen?.(step)}>{step === "compliance" ? "Go to compliance" : "Go to sentiment"}</Button>);
  const names = required.map(step => step === "compliance" ? "compliance" : "sentiment").join(" and ");
  return (
    <div role="status" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-medium">Before you can publish</p>
      <p>Complete the {names} check{required.length > 1 ? "s" : ""} for this revision. A check is missing, incomplete, or older than the latest content changes. Your publish date stays selected.</p>
      {onOpen && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
