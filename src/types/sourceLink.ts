export interface SubmissionSourceFields {
  source_links?: string[];
}

export interface SourceLinkClaim {
  claim: string;
  verdict: "SUPPORTED" | "NEEDS_CONTEXT" | "NOT_IN_SOURCE" | "CONTRADICTS" | "UNVERIFIED";
  where?: "caption" | "image";
  evidence?: string | null;
  source_location?: string | null;
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
