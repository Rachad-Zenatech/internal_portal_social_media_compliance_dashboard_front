import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Film, Image as ImageIcon, Layers, Loader2, MessageSquareText } from "lucide-react";
import { Link } from "react-router-dom";

import { authedFileUrl } from "@/components/submissions/submissionUi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { submissionService } from "@/services/submissionService";
import type { SubmissionFile } from "@/types/submission";

export interface TrainingEvidenceItem {
  text?: string | null;
  url?: string | null;
  author?: string | null;
  network?: string | null;
  sentiment?: string | null;
  relevance_status?: string | null;
}

export interface TrainingExampleRow {
  assessment_id: string;
  assessed_at: string;
  features: Record<string, number | null>;
  system_recommendation: string;
  reviewer_label: string;
  review_reason?: string | null;
  split?: string | null;
  submission_id?: string | null;
  post_title?: string | null;
  reference_code?: string | null;
  content_type?: string | null;
  brand_code?: string | null;
  post_status?: string | null;
  file_count?: number;
  reviewer_comments?: string[];
  decision_notes?: string | null;
  evidence_items?: TrainingEvidenceItem[];
}

function MediaPlayer({ files }: { files: SubmissionFile[] }) {
  const [slide, setSlide] = useState(0);
  const videos = files.filter((f) => f.mime_type.startsWith("video/"));
  const images = files.filter((f) => f.mime_type.startsWith("image/"));

  if (videos.length > 0) {
    const v = videos[0];
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Film className="h-3.5 w-3.5 text-primary" />
          <span>Video: {v.original_name}</span>
        </div>
        <video src={authedFileUrl(v.url)} controls className="max-h-72 w-full rounded-lg border bg-black object-contain" />
        {v.transcript && v.transcript.length > 0 && (
          <div className="max-h-28 overflow-auto rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Video speech transcript</p>
            <p>{v.transcript.map((s) => s.text).join(" ")}</p>
          </div>
        )}
      </div>
    );
  }

  if (images.length > 0) {
    const idx = Math.min(slide, images.length - 1);
    const img = images[idx];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {images.length > 1 ? <Layers className="h-3.5 w-3.5 text-primary" /> : <ImageIcon className="h-3.5 w-3.5 text-primary" />}
            <span>{images.length > 1 ? `Carousel (${idx + 1} / ${images.length})` : "Image"}: {img.original_name}</span>
          </span>
          {images.length > 1 && (
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon-sm" disabled={idx === 0} onClick={() => setSlide((s) => Math.max(0, s - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon-sm" disabled={idx === images.length - 1} onClick={() => setSlide((s) => Math.min(images.length - 1, s + 1))}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex justify-center rounded-lg border bg-muted/20 p-2">
          <img src={authedFileUrl(img.url)} alt={img.original_name} className="max-h-72 rounded object-contain" />
        </div>
      </div>
    );
  }

  return (
    <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
      No video, image, or carousel file attached to this draft.
    </p>
  );
}

function EvidenceSection({ items }: { items: TrainingEvidenceItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">Scraped X posts & news behind this assessment ({items.length})</p>
      <ul className="max-h-40 space-y-1.5 overflow-auto rounded-lg border bg-muted/20 p-2.5 text-xs">
        {items.map((item, i) => (
          <li key={i} className="border-l-2 border-border pl-2">
            <p className="text-foreground/90">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {item.text}
                </a>
              ) : (
                item.text
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {item.network || "X"} · {item.author || "Public"} · {item.sentiment || "NEUTRAL"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TrainingContentQuickOpen({
  example,
  onClose,
}: {
  example: TrainingExampleRow | null;
  onClose: () => void;
}) {
  const subId = example?.submission_id ?? null;
  const subQuery = useQuery({
    queryKey: ["training-data", "submission-preview", subId],
    queryFn: () => submissionService.get(subId!),
    enabled: Boolean(subId),
    staleTime: 60 * 1000,
  });

  if (!example) return null;
  const sub = subQuery.data;
  const comments = example.reviewer_comments ?? [];
  const evidence = example.evidence_items ?? [];

  return (
    <Dialog open={Boolean(example)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <span>{sub?.title || example.post_title || "Reviewed draft"}</span>
            {example.reference_code && <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{example.reference_code}</span>}
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {example.system_recommendation} → {example.reviewer_label}
            </span>
          </DialogTitle>
          <DialogDescription>
            Content type: {sub?.content_type || example.content_type || "SOCIAL_POST"} · Brand: {sub?.brand_code || example.brand_code || "—"} · Split: {example.split || "train"}
          </DialogDescription>
        </DialogHeader>

        {subQuery.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading video / image / carousel & caption...
          </div>
        ) : (
          <div className="space-y-4">
            <MediaPlayer files={sub?.files ?? []} />
            {sub?.caption_text && (
              <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                <p className="mb-1 flex items-center gap-1 font-semibold text-foreground"><FileText className="h-3.5 w-3.5" /> Caption</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{sub.caption_text}</p>
              </div>
            )}
          </div>
        )}

        {(example.review_reason || example.decision_notes || comments.length > 0) && (
          <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <MessageSquareText className="h-3.5 w-3.5 text-primary" /> Reviewer decision & comment notes
            </p>
            {example.review_reason && <p className="text-foreground/90">Reason: {example.review_reason}</p>}
            {example.decision_notes && <p className="text-muted-foreground">Decision note: {example.decision_notes}</p>}
            {comments.map((c, idx) => (
              <p key={idx} className="border-l-2 border-primary/40 pl-2 text-muted-foreground">“{c}”</p>
            ))}
          </div>
        )}

        <EvidenceSection items={evidence} />

        <DialogFooter showCloseButton>
          {subId && (
            <Button asChild size="sm">
              <Link to={`/submissions/${subId}`}>
                Open full submission <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
