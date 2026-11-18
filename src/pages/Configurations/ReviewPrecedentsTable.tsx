import { Eye, FileText, Film, Image as ImageIcon, Layers, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TrainingExampleRow } from "./TrainingContentQuickOpen";

export interface ReviewPrecedentRecord {
  id: string;
  submission_id: string;
  version_number: number;
  reference_code?: string | null;
  post_title?: string | null;
  content_type?: string | null;
  brand_code?: string | null;
  post_status?: string | null;
  decision: string;
  reviewer_label: string;
  decided_by_name?: string | null;
  decided_at?: string | null;
  decision_notes?: string | null;
  script_text?: string | null;
  caption_text?: string | null;
  reviewer_comments?: string[];
  dismissed_flags?: { rule_number?: string; reason?: string; note?: string }[];
}

function ContentBadge({ type }: { type?: string | null }) {
  const t = (type || "SOCIAL_POST").toUpperCase();
  const Icon = t === "VIDEO" ? Film : t === "CAROUSEL" ? Layers : t === "IMAGE" ? ImageIcon : FileText;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
      <Icon className="h-3 w-3 text-primary" />
      <span>{t}</span>
    </span>
  );
}

function toQuickOpenRow(rec: ReviewPrecedentRecord): TrainingExampleRow {
  return {
    assessment_id: rec.id,
    assessed_at: rec.decided_at || "",
    features: {},
    system_recommendation: rec.decision,
    reviewer_label: rec.reviewer_label,
    review_reason: rec.decision_notes || undefined,
    split: `v${rec.version_number}`,
    submission_id: rec.submission_id,
    post_title: rec.post_title,
    reference_code: rec.reference_code,
    content_type: rec.content_type,
    brand_code: rec.brand_code,
    post_status: rec.post_status,
    script_text: rec.script_text,
    caption_text: rec.caption_text,
    reviewer_comments: rec.reviewer_comments,
    decision_notes: rec.decision_notes,
  };
}

function PrecedentRow({ rec, onSelect }: { rec: ReviewPrecedentRecord; onSelect: (e: TrainingExampleRow) => void }) {
  const notes = [rec.decision_notes, ...(rec.reviewer_comments ?? [])].filter(Boolean).join(" · ") || "—";
  return (
    <tr className="border-t border-border/60 align-top hover:bg-muted/20">
      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
        {rec.decided_at ? new Date(rec.decided_at).toLocaleDateString() : "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <ContentBadge type={rec.content_type} />
          <span className="font-medium text-foreground">{rec.post_title || "Reviewed post"}</span>
          {rec.reference_code && <span className="text-[10px] font-mono text-muted-foreground">({rec.reference_code})</span>}
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="font-medium">{rec.decision}</span> → <span className="font-semibold text-primary">{rec.reviewer_label}</span>
      </td>
      <td className="max-w-sm truncate px-3 py-2.5 text-muted-foreground" title={notes}>{notes}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{rec.decided_by_name || "Reviewer"}</td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onSelect(toQuickOpenRow(rec))}>
          <Eye className="h-3 w-3" /> Quick open
        </Button>
      </td>
    </tr>
  );
}

export default function ReviewPrecedentsTable({
  records,
  onSelect,
}: {
  records: ReviewPrecedentRecord[];
  onSelect: (e: TrainingExampleRow) => void;
}) {
  return (
    <Card className="overflow-hidden py-0 shadow-xs">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <MessageSquareText className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Reviewer comments & precedent memory ({records.length})</h2>
        <span className="flex-1 text-xs text-muted-foreground">
          Past post reviews, comment notes, and approvals/change requests that train Reviewer Precedent Memory & sync to XGBoost
        </span>
      </div>
      {records.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No reviewer decisions or comments recorded on posts yet.
        </p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
              <tr>
                {["Reviewed", "Post (video / image / carousel)", "Decision → XGBoost label", "Reviewer comments & notes", "Reviewer", "Preview"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => (
                <PrecedentRow key={rec.id} rec={rec} onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
