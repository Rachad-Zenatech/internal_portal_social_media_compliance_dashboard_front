/** Source text is evidence for one script, kept separate from its spoken and visual content. */
export function scriptSourceEntries(text: string): { text: string; urls: string[] }[] {
  return text.split(/\r?\n|;\s+/).map((entry) => entry.trim()).filter(Boolean).map((entry) => ({
    text: entry,
    urls: [...new Set(entry.match(/https?:\/\/[^\s<>"\]]+/g) ?? [])].map((url) => url.replace(/[.,;)]+$/, "")),
  }));
}

export function scriptSourcesMatch(checked: string | undefined, sources: string): boolean {
  return (checked ?? "").trim() === sources.trim();
}
