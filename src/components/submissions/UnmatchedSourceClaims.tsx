import type { UnmatchedSourceClaim } from "@/lib/sourceClaimGroups";

export default function UnmatchedSourceClaims({ claims }: { claims: UnmatchedSourceClaim[] }) {
  if (claims.length === 0) return <p role="tabpanel" className="p-3 text-muted-foreground">No unmatched claims.</p>;
  return (
    <div role="tabpanel" className="space-y-3">
      <p className="text-sm text-muted-foreground">No source verified these claims or directly contradicted them. Some sources may still be unreadable or inconclusive.</p>
      <ul className="space-y-2">
        {claims.map(claim => <UnmatchedClaim key={claim.claim_id ?? `${claim.where}-${claim.claim}`} claim={claim} />)}
      </ul>
    </div>
  );
}

function UnmatchedClaim({ claim }: { claim: UnmatchedSourceClaim }) {
  const location = claim.locations.map(where => where === "image" ? "Image text" : "Caption").join(" and ");
  return (
    <li className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/30 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
      <p className="text-xs font-medium text-muted-foreground">{location}</p>
      <blockquote className="whitespace-pre-wrap text-sm text-foreground">{claim.claim}</blockquote>
      <p className="text-xs text-muted-foreground">Add relevant supporting evidence or review the wording.</p>
    </li>
  );
}
