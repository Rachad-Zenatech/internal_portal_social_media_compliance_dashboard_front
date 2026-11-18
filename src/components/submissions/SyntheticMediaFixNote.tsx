import type { ComplianceViolation } from "@/services/complianceService";

export default function SyntheticMediaFixNote({ finding }: { finding: ComplianceViolation }) {
  const syntheticMedia = /\b(ai|synthetic|renders?|rendering)\b/i.test(`${finding.category} ${finding.title}`);
  if (finding.kind !== "MISSING_DISCLAIMER" || !syntheticMedia) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[13px] leading-relaxed text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <p><strong className="font-semibold">Suggested disclaimer:</strong> &ldquo;Image for illustrative purposes only.&rdquo;</p>
      <p className="mt-1">Add it to the caption or visibly on the image. Use the rule&rsquo;s full approved label if more specific wording is required.</p>
    </div>
  );
}
