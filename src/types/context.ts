/** Kinds of Messaging Context the content analysis is given. */
export type ContextKind = "BRAND_VOICE" | "FACT" | "PLATFORM_NORM" | "AUDIENCE_PROFILE";

export interface ContextEntryInput {
  kind: ContextKind;
  title: string;
  body: string;
  do_examples: string | null;
  dont_examples: string | null;
  /** Empty: applies to every brand / audience / platform. */
  brands: string[];
  audiences: string[];
  platforms: string[];
  source: string | null;
  as_of: string | null;
  is_active: boolean;
}

export interface ContextEntry extends ContextEntryInput {
  id: string;
  /** One of the starter entries (editable like any other). */
  is_starter: boolean;
  /** Kept in sync with a source (NEWSROOM: the ZenaTech newsroom); the article it was read from. */
  auto_source?: string | null;
  source_url?: string | null;
  updated_at: string;
  updated_by_name?: string | null;
}

/** A sync of facts from the newsroom: running, or how the last one went. */
export interface ContextSync {
  id: string;
  status: "RUNNING" | "DONE" | "FAILED";
  trigger: string;
  started_at: string;
  finished_at?: string | null;
  found: number;
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  error?: string | null;
  started_by_name?: string | null;
}
