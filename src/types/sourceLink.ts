export interface SubmissionSourceFields {
  source_links?: string[];
}

export interface SourceLinkClaim {
  claim: string;
  /** As the server's source check gives it: the source says it, says otherwise, doesn't say it, or a person decides. */
  verdict: "SUPPORTED" | "CONTRADICTED" | "NOT_FOUND" | "UNCLEAR";
  where?: "caption" | "image";
  evidence?: string | null;
  source_location?: string | null;
  /** The source's own words at that place, word for word, for a person to read and confirm. */
  source_quote?: string | null;
  /** The page the quote is on, when another source than the check's own backed the claim. */
  source_url?: string | null;
  note?: string | null;
  confidence?: number;
}

export interface SourceLinkCheck {
  reference: string;
  kind: "URL" | "NAMED" | "DOCUMENT";
  where?: "caption" | "image" | "attached";
  cue?: string | null;
  status: "READ" | "UNREADABLE" | "NOT_PROVIDED";
  title?: string | null;
  url?: string | null;
  published?: string | null;
  authority?: "OFFICIAL" | "COMPANY" | "NEWS" | "OTHER" | null;
  message?: string | null;
  claims: SourceLinkClaim[];
  model?: string | null;
}

export interface ImageSourceCitation {
  kind: "URL" | "NAMED";
  reference: string;
  cue?: string | null;
}

export interface ImageSourceScanResponse {
  extracted_text: string;
  citations: ImageSourceCitation[];
  resolved_url?: string | null;
  /** The claims checked against every readable source found (up to two), merged claim by claim. */
  check?: SourceLinkCheck | null;
  /** Each readable source's own check, the most authoritative first. */
  source_checks?: SourceLinkCheck[];
  message?: string | null;
}

/** A whole article pasted in as the source, for pages the checker can't open. */
export interface PastedSourceRequest {
  text: string;
  title?: string;
  url?: string;
}

export interface ImageSourceScanJob extends ImageSourceScanResponse {
  job_id: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
}
