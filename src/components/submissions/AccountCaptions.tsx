import { Copy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PlatformIcon, { type SocialPlatform } from "@/components/video/PlatformIcon";
import type { AccountOption } from "@/types/submission";

/**
 * A caption for each publishing account the post goes to. The media is the same everywhere; an account left empty
 * uses the main caption. Plain text, since that's what the platforms publish.
 */
export function AccountCaptionsEditor({
  accounts,
  captions,
  mainCaption,
  limitFor,
  onChange,
}: {
  accounts: AccountOption[];
  captions: Record<string, string>;
  mainCaption: string;
  limitFor: (platform: string) => number;
  onChange: (next: Record<string, string>) => void;
}) {
  const set = (id: string, text: string) => onChange({ ...captions, [id]: text });
  const clear = (id: string) => {
    const next = { ...captions };
    delete next[id];
    onChange(next);
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
      <div>
        <p className="text-sm font-semibold text-foreground">Caption for each account</p>
        <p className="text-[11px] text-muted-foreground">
          The same media goes to every account. Write a different caption for an account here; one left empty uses the
          main caption above. Every caption is part of the compliance check.
        </p>
      </div>
      {accounts.map((a) => {
        const own = captions[a.id] ?? "";
        const text = own.trim() ? own : mainCaption;
        const limit = limitFor(a.platform);
        const over = text.trim().length > limit;
        return (
          <div key={a.id} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <PlatformIcon platform={a.platform as SocialPlatform} className="h-3.5 w-3.5" />
                {a.label}
                {!own.trim() && <span className="font-normal text-muted-foreground">· uses the main caption</span>}
              </p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px]"
                  disabled={!mainCaption.trim()}
                  onClick={() => set(a.id, mainCaption)}
                >
                  <Copy className="h-3 w-3" /> Start from main caption
                </Button>
                {own && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => clear(a.id)}>
                    <X className="h-3 w-3" /> Use main caption
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              value={own}
              onChange={(e) => set(a.id, e.target.value)}
              placeholder={mainCaption.trim() ? `Uses the main caption. Write a different one for ${a.label}…` : `Caption for ${a.label}`}
              className="min-h-[80px] text-sm"
              maxLength={100_000}
            />
            <p className={`text-right text-[11px] ${over ? "font-semibold text-red-600" : "text-muted-foreground"}`}>
              {text.trim().length.toLocaleString()}/{limit.toLocaleString()} characters{over ? " (too long for this platform)" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Read-only view of the captions per account, for reviewers and the post page. */
export function AccountCaptionsView({
  accounts,
  captions,
  mainCaption,
}: {
  accounts: AccountOption[];
  captions?: Record<string, string>;
  mainCaption?: string | null;
}) {
  if (accounts.length < 2 || !captions || !Object.keys(captions).length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caption for each account</p>
      <ul className="space-y-2">
        {accounts.map((a) => {
          const own = captions[a.id];
          return (
            <li key={a.id} className="space-y-0.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <PlatformIcon platform={a.platform as SocialPlatform} className="h-3.5 w-3.5" />
                {a.label}
                {!own && <span className="font-normal text-muted-foreground">· main caption</span>}
              </p>
              <p className="whitespace-pre-line text-sm text-foreground/90">{own || mainCaption || "No caption"}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
