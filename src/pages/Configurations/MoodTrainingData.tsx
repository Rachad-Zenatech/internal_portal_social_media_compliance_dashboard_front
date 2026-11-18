import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { apiClient } from "@/services/apiClient";

interface TrainingExample {
  assessment_id: string;
  assessed_at: string;
  features: Record<string, number | null>;
  system_recommendation: string;
  reviewer_label: string;
  review_reason?: string | null;
  split?: string | null;
  submission_id?: string | null;
}

interface TrainingData {
  dataset_version: string | null;
  total: number;
  splits: Record<string, number>;
  examples: TrainingExample[];
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

function ExampleRow({ example }: { example: TrainingExample }) {
  return (
    <tr className="border-t border-border/60 align-top">
      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(example.assessed_at).toLocaleDateString()}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        {example.system_recommendation} → <span className="font-semibold">{example.reviewer_label}</span>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{example.review_reason || "—"}</td>
      <td className="px-3 py-2 text-muted-foreground">{featureSummary(example.features)}</td>
      <td className="px-3 py-2 capitalize">{example.split ?? "—"}</td>
      <td className="px-3 py-2">
        {example.submission_id && (
          <Link to={`/submissions/${example.submission_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
            Open <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </td>
    </tr>
  );
}

function ExamplesTable({ data }: { data: TrainingData }) {
  if (data.examples.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No reviewed assessments have been used for training yet. Reviewer decisions on public-mood assessments become training examples.</p>;
  }
  const splits = Object.entries(data.splits).map(([name, n]) => `${name} ${n}`).join(" · ");
  return (
    <div>
      <p className="px-4 py-2 text-xs text-muted-foreground">
        Dataset {data.dataset_version} · {data.total} examples ({splits}). Showing the newest {data.examples.length}.
      </p>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
            <tr>
              {["Assessed", "System → reviewer", "Reason", "Inputs", "Split", "Draft"].map((h) => (
                <th key={h} className="px-3 py-1.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.examples.map((e) => (
              <ExampleRow key={e.assessment_id} example={e} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Quick panel: the reviewed assessments the XGBoost decision model was trained on (loaded when opened). */
export default function MoodTrainingData({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const query = useQuery({
    queryKey: ["training-data", "mood-examples"],
    queryFn: () => apiClient.get<TrainingData>("/api/listening/model/training-data", { skipGlobalLoading: true }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card className="overflow-hidden py-0 shadow-xs">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Decision model (XGBoost) training data</h2>
        <span className="flex-1 text-xs text-muted-foreground">Reviewed public-mood assessments it learned from</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border/70">
          {query.isLoading && <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>}
          {query.isError && <p className="p-4 text-sm text-muted-foreground">Couldn&apos;t load the training data (it needs permission to manage configuration).</p>}
          {query.data && <ExamplesTable data={query.data} />}
        </div>
      )}
    </Card>
  );
}
