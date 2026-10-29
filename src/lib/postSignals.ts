/**
 * Cashtags, hashtags and @mentions in a caption, read live as the writer types. Mirrors the patterns in the
 * backend's services/post_signals.py; the server check is the one that counts, this is instant feedback.
 */

const CASHTAG = /(?<![\w$])\$([A-Za-z][A-Za-z.]{0,14})(?![\w])/g;
const HASHTAG = /(?<![\w#&])#([A-Za-z][A-Za-z0-9_]{0,99})/g;
const MENTION = /(?<![\w@.])@([A-Za-z0-9_](?:[A-Za-z0-9_.]{0,48}[A-Za-z0-9_])?)/g;

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface CaptionSignals {
  cashtags: string[];
  hashtags: string[];
  mentions: string[];
}

export function readSignals(text: string): CaptionSignals {
  return {
    cashtags: unique([...text.matchAll(CASHTAG)].map((m) => `$${m[1].replace(/\.+$/, "")}`)),
    hashtags: unique([...text.matchAll(HASHTAG)].map((m) => `#${m[1]}`)),
    mentions: unique([...text.matchAll(MENTION)].map((m) => `@${m[1]}`)),
  };
}

/** Whether the caption already has this tag (case doesn't matter, "#ZenaTech" doesn't match "#ZenaTechLife"). */
export function hasTag(text: string, tag: string): boolean {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w#$])${escaped}(?![\\w])`, "i").test(text);
}
