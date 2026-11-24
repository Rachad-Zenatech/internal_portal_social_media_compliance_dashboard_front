import { FileText } from "lucide-react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { withLinkToken } from "@/lib/linkToken";
import { contextService } from "@/services/contextService";
import type { BrandVoice } from "@/types/context";

export function BrandVoiceLogo({ voice, showManualSections }: { voice: BrandVoice; showManualSections: boolean }) {
  if (showManualSections) return <FileText className="h-5 w-5 text-muted-foreground" />;
  if (!voice.has_logo) return <span className="text-[10px] text-muted-foreground">No logo</span>;
  const url = withLinkToken(contextService.brandLogoUrl(voice.brand_code) + "?v=" + encodeURIComponent(voice.extracted_at ?? ""));
  return <img src={url} alt={voice.brand_name + " logo"} className="h-full w-full object-contain" />;
}

export function BrandVoiceDialogHeader({ brandName }: { brandName: string }) {
  return (
    <DialogHeader>
      <DialogTitle>{brandName} brand voice</DialogTitle>
      <DialogDescription>What content for {brandName} is checked against. Changes apply to new analyses.</DialogDescription>
    </DialogHeader>
  );
}
