/** Result of comparing a video with its retained approved script. */
export type ScriptMatch = {
  status: "MATCH" | "PARTIAL" | "MISMATCH" | "PENDING" | "UNAVAILABLE";
  similarity: number | null;
  message?: string;
  script_words: number;
  spoken_words: number;
  added: string[];
  missing: string[];
  added_more: number;
  missing_more: number;
};
