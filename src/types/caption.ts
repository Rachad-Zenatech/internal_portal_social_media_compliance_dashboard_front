/** Caption suggestions drafted from the post itself, each already run through the compliance check. */

export interface CaptionCheck {
  score: number;
  traffic_light: "GREEN" | "YELLOW" | "RED" | string;
  blocked: boolean;
  /** Rule numbers and the words they flagged. */
  flags: string[];
}

export interface CaptionSuggestion {
  style: string;
  text: string;
  hashtags: string[];
  /** Caption plus hashtags, as it would be posted. */
  characters: number;
  check: CaptionCheck;
}

/** One tag in the hashtag library: a hashtag, or the company cashtag with what using it changes. */
export interface LibraryTag {
  tag: string;
  note?: string | null;
}

export interface LibraryGroup {
  label: string;
  tags: LibraryTag[];
}

/** Hashtags (and the cashtag) suited to a post's brand, audience and platforms, already screened by the rulebook. */
export interface HashtagLibrary {
  groups: LibraryGroup[];
  /** The most hashtags the strictest selected platform suits. */
  max_hashtags: number;
  /** e.g. "Up to 2 for X"; null when no platform is selected. */
  max_reason?: string | null;
  cashtag: string;
}

export interface CaptionSuggestions {
  suggestions: CaptionSuggestion[];
  /** What the suggestions were based on, e.g. "3 images", "the video transcript". */
  based_on: string[];
  /** Anything it couldn't see or had to guess. */
  notes: string[];
  model?: string | null;
}
