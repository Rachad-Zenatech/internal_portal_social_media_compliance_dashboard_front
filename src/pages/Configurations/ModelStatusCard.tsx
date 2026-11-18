import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { apiClient } from "@/services/apiClient";

interface ModelStatus {
  xgboost_installed?: boolean;
  mode?: string;
  model_loaded?: boolean;
  note?: string;
  error?: string;
  load_error?: string;
  run?: string;
  model_updated_at?: string | null;
  training_summary?: {
    dataset_version?: string | null;
    training_rows?: number | null;
    class_count?: number;
    feature_count?: number;
    boosting_rounds?: number;
  };
  class_distribution?: Record<string, number> | null;
  feature_importance?: { feature: string; importance: number }[];
  auto_training?: { enabled?: boolean };
}

function Stat({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value ?? "—"}</p>
    </div>
  );
}

function FeatureImportance({ items }: { items: { feature: string; importance: number }[] }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.importance)) || 1;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">What the model weighs most</p>
      {items.map((i) => (
        <div key={i.feature} className="flex items-center gap-2 text-xs">
          <span className="w-44 shrink-0 truncate">{i.feature}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${(i.importance / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The XGBoost decision model: is it on, what it was trained on and what it weighs most. */
export default function ModelStatusCard() {
  const query = useQuery({
    queryKey: ["training-data", "mood-model-status"],
    queryFn: () => apiClient.get<ModelStatus>("/api/listening/model/status", { skipGlobalLoading: true }),
    staleTime: 60 * 1000,
  });

  if (query.isLoading) {
    return <Card className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading model status…</Card>;
  }
  if (query.isError || !query.data) {
    return <Card className="p-5 text-sm text-muted-foreground">Model status is unavailable (it needs permission to manage configuration).</Card>;
  }
  const s = query.data;
  const t = s.training_summary ?? {};
  const classes = Object.entries(s.class_distribution ?? {}).map(([k, v]) => `${k} ${v}`).join(" · ");
  return (
    <Card className="space-y-4 p-4 shadow-xs">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Mode" value={s.mode} />
        <Stat label="XGBoost" value={s.xgboost_installed ? (s.model_loaded ? "Loaded" : "Installed, no model") : "Not installed"} />
        <Stat label="Training rows" value={t.training_rows} />
        <Stat label="Boosting rounds" value={t.boosting_rounds} />
      </div>
      <p className="text-xs text-muted-foreground">
        {s.note || `Dataset ${t.dataset_version ?? "—"} · ${t.feature_count ?? "—"} features · classes: ${classes || "—"} · automatic retraining ${s.auto_training?.enabled ? "on" : "off"}`}
        {(s.error || s.load_error) && ` · ${s.error || s.load_error}`}
      </p>
      <FeatureImportance items={s.feature_importance ?? []} />
    </Card>
  );
}
