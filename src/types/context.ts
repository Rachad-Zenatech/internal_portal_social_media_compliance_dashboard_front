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
  updated_at: string;
  updated_by_name?: string | null;
}
