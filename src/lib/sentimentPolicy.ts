/** Text posts and script-only video drafts do not use sentiment analysis. */
export function usesSentiment(contentType?: string | null, scriptOnly = false): boolean {
  return contentType !== "TEXT_POST" && !scriptOnly;
}
