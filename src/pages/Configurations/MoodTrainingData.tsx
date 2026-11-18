import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, FileText, Film, Image as ImageIcon, Layers, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/services/apiClient";
import TrainingContentQuickOpen, { type TrainingExampleRow } from "./TrainingContentQuickOpen";

interface TrainingReadiness {
  ready: boolean;
  min_per_class: Record<string, number>;
  total_needed_per_class: number;
  class_totals: Record<string, number>;
  class_counts: Record<string, Record<string, number>>;
  shortfalls: string[];
  unreviewed_assessments: number;
}

interface TrainingData {
  dataset_version: string | null;
  is_live_preview?: boolean;
  total: number;
  splits: Record<string, number>;
  examples: TrainingExampleRow[];
  readiness?: TrainingReadiness;
}

const FEATURE_LABELS: Record<string, string> = {
  relevant_item_count: "items",
  distinct_story_count: "stories",
  negative_share: "negative",
  severe_event_count: "severe",
  unique_author_count: "authors",
};

function featureSummary(features: Record<string, number | null>): string {
  return Object.entries(FEATURE_LABELS)
    .filter(([key]) => features[key] != null)
    .map(([key, label]) => `${label} ${key === "negative_share" ? `${Math.round(Number(features[key]) * 100)}%` : features[key]}`)
    .join(" · ");
}

function ContentTypeBadge({ type }: { type?: string | null }) {
  const t = (type || "SOCIAL_POST").toUpperCase();
  const Icon = t === "VIDEO" ? Film : t === "CAROUSEL" ? Layers : t === "IMAGE" ? ImageIcon : FileText;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
      <Icon className="h-3 w-3 text-primary" />
      <span>{t}</span>
    </span>
  );
}

function ReadinessBar({ readiness }: { readiness?: TrainingReadiness }) {
  if (!readiness) return null;
  const needed = readiness.total_needed_per_class || 30;
  const classes = ["POST", "WAIT", "HOLD"] as const;
  return (
    <div className="space-y-3 border-b border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">
            XGBoost Training Readiness · {readiness.ready ? "Ready to train" : `${needed} reviewed examples per decision needed (20 train · 5 val · 5 test)`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Reviewer decisions & comment notes on assessments or post approvals automatically feed these buckets.
            {readiness.unreviewed_assessments > 0 && ` (${readiness.unreviewed_assessments} assessed drafts awaiting review decision)`}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {classes.map((cls) => {
          const count = readiness.class_totals?.[cls] ?? 0;
          const pct = Math.min(100, Math.round((count / needed) * 100));
          return (
            <div key={cls} className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{cls}</span>
                <span className="text-muted-foreground">{count} / {needed}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className={pct >= 100 ? "h-full bg-emerald-500" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExampleRow({ example, onSelect }: { example: TrainingExampleRow; onSelect: (e: TrainingExampleRow) => void }) {
  const note = example.review_reason || example.decision_notes || example.reviewer_comments?.[0] || "—";
  return (
    <tr className="border-t border-border/60 align-top hover:bg-muted/20">
      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
        {example.assessed_at ? new Date(example.assessed_at).toLocaleDateString() : "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <ContentTypeBadge type={example.content_type} />
          <span className="font-medium text-foreground">{example.post_title || "Reviewed draft"}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {example.system_recommendation} → <span className="font-semibold text-primary">{example.reviewer_label}</span>
      </td>
      <td className="max-w-xs truncate px-3 py-2.5 text-muted-foreground" title={note}>{note}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{featureSummary(example.features)}</td>
      <td className="px-3 py-2.5 capitalize">{example.split ?? "train"}</td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onSelect(example)}>
          <Eye className="h-3 w-3" /> Quick open
        </Button>
      </td>
    </tr>
  );
}

function ExamplesTable({ data, onSelect }: { data: TrainingData; onSelect: (e: TrainingExampleRow) => void }) {
  if (data.examples.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No reviewed assessments have been recorded yet. When a reviewer approves/requests changes on an assessed post or confirms/corrects a public-mood recommendation, the post&apos;s video/image/carousel, features, and reviewer comments appear here.
      </p>
    );
  }
  const splits = Object.entries(data.splits).map(([name, n]) => `${name} ${n}`).join(" · ");
  return (
    <div>
      <p className="px-4 py-2 text-xs text-muted-foreground">
        {data.dataset_version ? `Dataset ${data.dataset_version}` : "Live reviewed examples queued for next XGBoost build"} · {data.total} examples ({splits}).
      </p>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
            <tr>
              {["Assessed", "Content (video / image / carousel)", "System → reviewer", "Reviewer comment / reason", "XGBoost features", "Split", "Preview"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.examples.map((e) => (
              <ExampleRow key={e.assessment_id} example={e} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MoodTrainingData() {
  const [selected, setSelected] = useState<TrainingExampleRow | null>(null);
  const query = useQuery({
    queryKey: ["training-data", "mood-examples"],
    queryFn: () => apiClient.get<TrainingData>("/api/listening/model/training-data", { skipGlobalLoading: true }),
    staleTime: 60 * 1000,
  });

  return (
    <>
      <Card className="overflow-hidden py-0 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">XGBoost training dataset & reviewed content</h2>
          <span className="flex-1 text-xs text-muted-foreground">
            Click Quick open on any row to preview the video, image, carousel, reviewer comment notes, and scraped X/news evidence
          </span>
        </div>
        {query.isLoading && (
          <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading XGBoost training data…
          </p>
        )}
        {query.isError && (
          <p className="p-4 text-sm text-muted-foreground">
            Couldn&apos;t load the training data (requires configuration permission).
          </p>
        )}
        {query.data && (
          <>
            <ReadinessBar readiness={query.data.readiness} />
            <ExamplesTable data={query.data} onSelect={setSelected} />
          </>
        )}
      </Card>
      <TrainingContentQuickOpen example={selected} onClose={() => setSelected(null)} />
    </>
  );
}
