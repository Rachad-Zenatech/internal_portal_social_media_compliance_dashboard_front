import { PenLine, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";

/**
 * A post going to more than one platform: each platform uses the main caption unless the creator writes it its own
 * (shorter for X, more formal for LinkedIn...). Every caption written here is screened with the rest of the post.
 */
export default function PlatformCaptions({
  platforms,
  captions,
  mainCaption,
  limitFor,
  readOnly = false,
  onChange,
}: {
  platforms: string[];
  /** Platform → its own caption (plain text). Platforms not in here use the main caption. */
  captions: Record<string, string>;
  mainCaption: string;
  limitFor: (platform: string) => number | undefined;
  readOnly?: boolean;
  onChange: (next: Record<string, string>) => void;
}) {
  const own = platforms.filter((p) => p in captions);
  const set = (platform: string, text: string) => onChange({ ...captions, [platform]: text });
  const drop = (platform: string) => {
    const next = { ...captions };
    delete next[platform];
    onChange(next);
  };

  return (
    <div className="mt-4 rounded-lg border border-border/80">
      <div className="border-b border-border/70 bg-muted/30 px-3.5 py-2.5">
        <p className="text-sm font-semibold text-foreground">A different caption for each platform</p>
        <p className="text-xs text-muted-foreground">
          {own.length
            ? `${own.length} of ${platforms.length} platforms have their own caption; the rest use the one above.`
            : "Every platform uses the caption above. Write one for a platform if it needs its own wording or length."}
        </p>
      </div>
      <ul className="divide-y divide-border/70">
        {platforms.map((p) => {
          const label = PLATFORM_LABELS[p as SocialPlatform] ?? p;
          const custom = p in captions;
          const text = captions[p] ?? "";
          const limit = limitFor(p);
          const length = (custom ? text : mainCaption).trim().length;
          const tooLong = limit != null && length > limit;
          return (
            <li key={p} className="px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <PlatformIcon platform={p as SocialPlatform} className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className={`text-xs ${custom ? "font-semibold text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                    {custom ? "Its own caption" : "Uses the main caption"}
                  </span>
                </div>
                {!readOnly &&
                  (custom ? (
                    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => drop(p)}>
                      <Undo2 className="h-3.5 w-3.5" /> Use the main caption
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => set(p, mainCaption.trim())}>
                      <PenLine className="h-3.5 w-3.5" /> Write its own
                    </Button>
                  ))}
              </div>
              {custom && (
                <textarea
                  value={text}
                  readOnly={readOnly}
                  onChange={(e) => set(p, e.target.value)}
                  placeholder={`The caption for ${label}`}
                  aria-label={`Caption for ${label}`}
                  rows={4}
                  className={`mt-2 w-full resize-y rounded-md border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    tooLong || !text.trim() ? "border-red-500" : "border-input"
                  }`}
                />
              )}
              {limit != null && (custom || tooLong) && (
                <p className={`mt-1 text-right text-[11px] ${tooLong ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
                  {length.toLocaleString()}/{limit.toLocaleString()} characters{tooLong ? ` (too long for ${label})` : ""}
                </p>
              )}
              {custom && !text.trim() && (
                <p className="mt-1 text-[11px] text-red-600">Write the caption, or switch back to the main one.</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
