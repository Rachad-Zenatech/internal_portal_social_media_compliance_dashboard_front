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

export interface CaptionSuggestions {
  suggestions: CaptionSuggestion[];
  /** What the suggestions were based on, e.g. "3 images", "the video transcript". */
  based_on: string[];
  /** Anything it couldn't see or had to guess. */
  notes: string[];
  model?: string | null;
}
