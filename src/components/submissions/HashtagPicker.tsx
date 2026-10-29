import { Check, Loader2, TrendingUp } from "lucide-react";

import { hasTag, readSignals } from "@/lib/postSignals";
import type { HashtagLibrary } from "@/types/caption";

/**
 * The Hashtags picker: tags suited to the post's brand, audience and platforms (already screened by the rulebook),
 * plus the company cashtag with what it changes. Clicking a tag adds it; clicking one that's in the caption removes it.
 */
export default function HashtagPicker({
  library,
  loading,
  caption,
  hasBrand,
  onAdd,
  onRemove,
}: {
  library: HashtagLibrary | undefined;
  loading: boolean;
  caption: string;
  hasBrand: boolean;
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-1.5 px-1 py-2 text-[11px] text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading hashtags...
      </p>
    );
  }
  if (!library) {
    return <p className="px-1 py-2 text-[11px] text-muted-foreground">Couldn't load hashtag suggestions. Type your own.</p>;
  }

  const used = readSignals(caption).hashtags.length;
  const max = library.max_hashtags;
  const full = max > 0 && used >= max;
  return (
    <div className="space-y-2.5">
      <p className={`px-1 text-[11px] ${used > max ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
        {max === 0
          ? `${library.max_reason ?? "No hashtags for these platforms"}.`
          : `${used} of ${max} hashtags used${library.max_reason ? ` · ${library.max_reason}` : ""}.`}
        {!hasBrand && " Pick a brand for tags that fit it."}
      </p>
      {library.groups.map((group) => {
        const note = group.tags.find((t) => t.note)?.note;
        return (
          <div key={group.label}>
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.tags.map(({ tag }) => {
                const inCaption = hasTag(caption, tag);
                const isCashtag = tag.startsWith("$");
                // Hashtags stop being offered once the platforms' count is reached; the cashtag doesn't count.
                const blocked = !inCaption && !isCashtag && (full || max === 0);
                return (
                  <button
                    key={tag}
                    type="button"
                    title={inCaption ? `Remove ${tag}` : blocked ? "The hashtag limit for these platforms is reached" : `Add ${tag}`}
                    disabled={blocked}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (inCaption ? onRemove(tag) : onAdd(tag))}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      inCaption
                        ? "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        : isCashtag
                        ? "border-emerald-500/40 hover:bg-emerald-500/10"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {inCaption ? <Check className="w-3 h-3" /> : isCashtag ? <TrendingUp className="w-3 h-3" /> : null}
                    {tag}
                  </button>
                );
              })}
            </div>
            {note && <p className="px-1 pt-1 text-[10px] leading-snug text-muted-foreground">{note}</p>}
          </div>
        );
      })}
      <p className="px-1 text-[10px] text-muted-foreground">Click a ticked tag to take it out of the caption.</p>
    </div>
  );
}
