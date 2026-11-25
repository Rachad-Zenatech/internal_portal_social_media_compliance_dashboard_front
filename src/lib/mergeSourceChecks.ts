import type { SourceCheck, SourceClaim } from "@/services/complianceService";
import type { SourceLinkCheck } from "@/types/sourceLink";

/** Normalize known aliases without conflating different pages or meaningful query parameters. */
export function sourceIdentity(value: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    if (!url.hostname.includes(".")) return value.trim();
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const armyArticle = host === "army.mil" && url.pathname.match(/^\/article\/(\d+)(?:\/|$)/i);
    if (armyArticle) return `${host}/article/${armyArticle[1]}`;
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return `${host}${url.port ? `:${url.port}` : ""}${url.pathname.replace(/\/+$/, "")}${url.search}`;
  } catch {
    return value.trim();
  }
}

function identity(source: SourceCheck): string {
  return source.kind === "URL" ? `URL:${sourceIdentity(source.url || source.reference)}` : `${source.kind}:${source.reference}`;
}

function uniqueClaims(claims: SourceClaim[]): SourceClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    // Keep conflicting verdicts and different post locations visible for review.
    const key = JSON.stringify([claim.where, claim.claim.toLowerCase().replace(/\s+/g, " ").trim(), claim.verdict,
      claim.source_url ? sourceIdentity(claim.source_url) : ""]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Full compliance results take precedence over older quick checks for the same article. */
export function mergeSourceChecks(checks?: SourceCheck[] | null, savedChecks?: Record<string, SourceLinkCheck>): SourceCheck[] {
  const merged = new Map<string, SourceCheck>();
  for (const source of checks ?? []) {
    const key = identity(source);
    const previous = merged.get(key);
    const origins = [...new Set([...(previous?.origins ?? (previous ? [previous.where] : [])), ...(source.origins ?? [source.where])])];
    if (!previous) {
      merged.set(key, { ...source, origins, claims: uniqueClaims(source.claims) });
      continue;
    }
    const preferred = previous.status !== "READ" && source.status === "READ" ? source : previous;
    merged.set(key, { ...source, ...preferred, origins,
      where: previous.where === "newsroom" ? source.where : previous.where,
      claims: uniqueClaims([...previous.claims, ...source.claims]),
    });
  }
  const additions: SourceCheck[] = [];
  for (const [url, saved] of Object.entries(savedChecks ?? {})) {
    if (!saved) continue;
    const source: SourceCheck = { ...saved, reference: saved.reference || url, where: saved.where ?? "caption",
      claims: (saved.claims ?? []).map((claim) => ({ ...claim, where: claim.where ?? "caption", confidence: claim.confidence ?? 0 })),
    };
    const key = identity(source);
    if (!merged.has(key)) additions.push(source);
  }
  return additions.length ? mergeSourceChecks([...merged.values(), ...additions]) : [...merged.values()];
}
