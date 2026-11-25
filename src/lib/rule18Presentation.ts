import type { ComplianceViolation } from "@/services/complianceService";

export function isRule18(v: Pick<ComplianceViolation, "rule_number">): boolean {
  return v.rule_number.replace(/^rule\s*/i, "").trim() === "18";
}

/** Group evidence findings without changing the stored claims or their penalties. */
export function groupRule18<T>(items: T[], violation: (item: T) => ComplianceViolation): T[][] {
  const evidence = items.filter((item) => isRule18(violation(item)));
  let added = false;
  return items.flatMap((item) => {
    if (!isRule18(violation(item))) return [[item]];
    if (added) return [];
    added = true;
    return [evidence];
  });
}

export function rule18Penalty(findings: ComplianceViolation[]): number {
  return findings.reduce((total, v) => total + (v.counted_with ? 0 : v.penalty ?? 0), 0);
}

/** Evidence regions appear only while that individual claim is selected. */
export function previewFindings<T extends { v: ComplianceViolation; key: string }>(items: T[], selected: string | null): T[] {
  return items.filter((item) => !isRule18(item.v) || item.key === selected);
}
