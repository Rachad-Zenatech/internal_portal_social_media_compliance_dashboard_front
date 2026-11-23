import type { StoredCheck } from "@/types/submission";

export function sourceLinksKey(links: string[] = []): string {
  return JSON.stringify([...new Set(links.map((url) => url.trim().split("#")[0].replace(/\/+$/, "")).filter(Boolean))].sort());
}

/** Compare inputs, including checks saved before explicit source snapshots existed. */
export function complianceSourcesChanged(check: StoredCheck | null | undefined, links: string[]): boolean {
  if (!check) return false;
  const checked = check.checked_source_links ?? (check.source_checks ?? [])
    .filter((source) => source.where === "source_links")
    .map((source) => source.reference || source.url || "");
  return sourceLinksKey(checked) !== sourceLinksKey(links);
}
