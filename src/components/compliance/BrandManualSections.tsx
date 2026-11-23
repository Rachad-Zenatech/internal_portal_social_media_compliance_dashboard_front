import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrandManualSections } from "@/hooks/useBrandManualSections";
import { withLinkToken } from "@/lib/linkToken";
import { contextService } from "@/services/contextService";
import type { BrandManualSection, BrandVoice } from "@/types/context";

function ManualSection({ section, voice }: { section: BrandManualSection; voice: BrandVoice }) {
  const version = encodeURIComponent(voice.manual_uploaded_at ?? "");
  const preview = withLinkToken(`${contextService.brandManualPageUrl(voice.brand_code, section.page)}?v=${version}`);
  const original = `${withLinkToken(contextService.brandManualUrl(voice.brand_code))}#page=${section.page}`;
  const hasText = Boolean(section.text.trim());
  return (
    <section className="space-y-3 border-t border-border/70 pt-4" aria-label={section.title}>
      <div>
        <p className="text-[11px] text-muted-foreground">Page {section.page}</p>
        <h3 className="text-sm font-semibold">{section.title}</h3>
      </div>
      {hasText && <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">{section.text}</p>}
      <a href={original} target="_blank" rel="noreferrer" className="block" title={`Open page ${section.page} in the original manual`}>
        <img src={preview} alt={`${section.title}, page ${section.page}: original manual artwork`}
          width={section.width} height={section.height} loading="lazy" className="h-auto w-full rounded-lg border border-border/70" />
      </a>
    </section>
  );
}

/** Every page's text and artwork remain available, even when AI extraction is unavailable. */
export default function BrandManualSections({ voice }: { voice: BrandVoice }) {
  const query = useBrandManualSections(voice.brand_code, voice.manual_uploaded_at);
  if (query.isLoading) {
    return <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading the full manual...</p>;
  }
  if (query.isError) {
    return (
      <div className="space-y-2 py-3 text-xs">
        <p className="text-red-700 dark:text-red-300">Couldn't load the full manual: {(query.error as Error).message}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Try again</Button>
      </div>
    );
  }
  if (!query.data?.length) return <p className="py-3 text-xs text-muted-foreground">This PDF has no pages to show.</p>;
  return <div className="space-y-5">{query.data.map((section) => <ManualSection key={section.page} section={section} voice={voice} />)}</div>;
}
