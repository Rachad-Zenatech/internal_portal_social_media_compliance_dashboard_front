import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";

/** Read-only: the caption each platform publishes, for reviewers and the post page. Hidden when every platform
 * uses the main caption. */
export default function PlatformCaptionsView({
  platforms,
  captions,
  mainCaption,
}: {
  platforms: string[];
  captions?: Record<string, string>;
  mainCaption?: string | null;
}) {
  const own = platforms.filter((p) => captions?.[p]?.trim());
  if (platforms.length < 2 || !own.length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caption for each platform</p>
      <ul className="space-y-2">
        {platforms.map((p) => {
          const text = captions?.[p]?.trim();
          return (
            <li key={p} className="space-y-0.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <PlatformIcon platform={p as SocialPlatform} className="h-3.5 w-3.5" />
                {PLATFORM_LABELS[p as SocialPlatform] ?? p}
                {!text && <span className="font-normal text-muted-foreground">· main caption</span>}
              </p>
              <p className="whitespace-pre-line text-sm text-foreground/90">{text || mainCaption || "No caption"}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
