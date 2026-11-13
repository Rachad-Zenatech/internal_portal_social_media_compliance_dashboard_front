/** People's calls on the sources a post was checked against, and the standing a site earns from reviewers' calls. */

export interface SourceConfirmation {
  url: string;
  /** null for a call on the page itself (good or poor source). */
  claim?: string | null;
  matches?: boolean | null;
  good_source?: boolean | null;
  by_reviewer: boolean;
  /** The signed-in person's own call. */
  mine: boolean;
}

export interface SourceTrust {
  host: string;
  /** TRUSTED: reviewers rated it good (or checked several claims against it). FLAGGED: rated poor. */
  level: "TRUSTED" | "UNRATED" | "FLAGGED";
  confirmations: number;
  matches: number;
  good_votes: number;
  poor_votes: number;
  message: string;
}

export interface SourceConfirmationsResponse {
  confirmations: SourceConfirmation[];
  /** By site (lower case, without "www."). */
  trust: Record<string, SourceTrust>;
  /** The signed-in person decides on this post (reviewer, delegate or final approver, not its author), so their calls
   *  count towards a site's standing. */
  counts_toward_trust: boolean;
}

/** One call: with a claim, does it match the page (null takes it back); without, is the page a good source. */
export interface SourceConfirmationRequest {
  url: string;
  claim?: string;
  source_quote?: string | null;
  matches?: boolean | null;
  good_source?: boolean | null;
}
