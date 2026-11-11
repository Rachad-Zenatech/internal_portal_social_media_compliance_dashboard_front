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

/** NONE: no manual yet. PROCESSING: being read. DONE: read in full. PARTIAL: the AI couldn't read it, so only the
 * colour codes, fonts and a logo guess came from the PDF itself. FAILED: nothing could be read. */
export type BrandVoiceStatus = "NONE" | "PROCESSING" | "DONE" | "PARTIAL" | "FAILED";

export interface BrandColor {
  name?: string | null;
  hex: string;
  usage?: string | null;
}

/** A row of swatches in the manual (e.g. the tints of a main colour), read straight from the PDF. */
export interface PaletteRow {
  base_hex: string;
  label: string;
  colors: string[];
}

export interface BrandTypeface {
  name: string;
  role?: string | null;
  usage?: string | null;
}

/** What can be edited by hand. */
export interface BrandVoiceInput {
  voice?: string | null;
  tone: string[];
  do_examples: string[];
  dont_examples: string[];
  colors: BrandColor[];
  typefaces: BrandTypeface[];
  logo_notes?: string | null;
}

/** A brand's voice, read from its brand manual (PDF) or written by hand. */
export interface BrandVoice extends BrandVoiceInput {
  brand_code: string;
  brand_name: string;
  /** The extended palette shown in the manual, by main colour. */
  palette: PaletteRow[];
  status: BrandVoiceStatus;
  error?: string | null;
  manual_name?: string | null;
  manual_size?: number | null;
  manual_uploaded_at?: string | null;
  has_logo: boolean;
  extracted_at?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
  can_edit: boolean;
}
