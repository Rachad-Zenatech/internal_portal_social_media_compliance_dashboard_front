import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  support_thresholds?: {
    min_class_support_for_auto?: number;
    stale_evidence_hours?: number;
    min_confidence?: number;
  };
  training_summary?: {
    dataset_version?: string | null;
    training_rows?: number | null;
    class_count?: number;
    feature_count?: number;
    boosting_rounds?: number;
  };
  class_distribution?: Record<string, number> | null;
  feature_importance?: { feature: string; importance: number }[];
  auto_training?: { enabled?: boolean; last_attempt?: { outcome?: string; reason?: string; at?: string } | null };
}

type StatKey = "mode" | "xgboost" | "rows" | "rounds";

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  relevant_item_count: "Total verified scraped X posts and news items matching the post's topics.",
  distinct_story_count: "Distinct underlying news stories (deduplicating multiple articles covering the same event).",
  negative_share: "Fraction of distinct stories that have negative sentiment (0.0 to 1.0).",
  severe_event_count: "Number of stories with severe negative compound score (<= -0.60) or multiple crisis flags.",
  unique_author_count: "Number of unique authors or news outlets discussing the topic.",
  snapshot_age_minutes: "How many minutes old the scraped social-listening collection was when assessed.",
  collection_partial: "0 if the scrape succeeded across all configured sources, 1 if partial.",
  activity_change: "Percentage change in story volume over the last 3 days compared to the 3 days prior.",
};

function Stat({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string | number | undefined | null;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border border-border/70 p-3 text-left transition hover:border-primary/60 hover:bg-muted/20"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground group-hover:text-primary">{label}</p>
        <Info className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
      </div>
      <p className="mt-1 text-lg font-semibold">{value ?? "—"}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint} · Click for info</p>
    </button>
  );
}

function FeatureImportance({ items }: { items: { feature: string; importance: number }[] }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.importance)) || 1;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">What the model weighs most</p>
      {items.map((i) => (
        <div key={i.feature} className="flex items-center gap-2 text-xs" title={FEATURE_DESCRIPTIONS[i.feature]}>
          <span className="w-44 shrink-0 truncate">{i.feature}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${(i.importance / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatExplainDialog({ stat, data, onClose }: { stat: StatKey | null; data: ModelStatus; onClose: () => void }) {
  if (!stat) return null;
  const t = data.training_summary ?? {};
  const last = data.auto_training?.last_attempt;
  const info: Record<StatKey, { title: string; subtitle: string; body: React.ReactNode }> = {
    mode: {
      title: `Decision Mode: ${data.mode || "shadow"}`,
      subtitle: "Controls how XGBoost interacts with the rule-based public-mood engine.",
      body: (
        <ul className="list-disc space-y-2 pl-4 text-xs text-muted-foreground">
          <li><strong>shadow (current default):</strong> The deterministic rules make the live recommendation shown to users, while any registered XGBoost model computes its prediction in the background and logs it on the assessment record so accuracy can be compared safely.</li>
          <li><strong>assist:</strong> When a promoted XGBoost model is confident (above {Math.round((data.support_thresholds?.min_confidence ?? 0.65) * 100)}% confidence) and guardrails pass, its recommendation is used.</li>
          <li><strong>off:</strong> Only the deterministic rules run.</li>
        </ul>
      ),
    },
    xgboost: {
      title: `XGBoost Status: ${data.xgboost_installed ? (data.model_loaded ? "Model Loaded" : "Installed, awaiting training threshold") : "Not installed"}`,
      subtitle: "Why no model is registered yet and when automatic training kicks in.",
      body: (
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>{data.note || "XGBoost is installed and ready."}</p>
          <p><strong>Automatic retraining:</strong> {data.auto_training?.enabled ? "Enabled" : "Disabled"}. Whenever a reviewer decides on a post or public-mood assessment, the background trainer checks if there are at least <strong>30 reviewed examples per class (20 train, 5 validation, 5 test for POST, WAIT, and HOLD)</strong>.</p>
          {last?.reason && <p className="rounded border bg-muted/30 p-2"><strong>Last auto-train check:</strong> {last.outcome} — {last.reason}</p>}
        </div>
      ),
    },
    rows: {
      title: `Training Rows (${t.training_rows ?? "Not built yet"}) & 8 Input Features`,
      subtitle: "Each training row is a frozen snapshot of 8 social-listening measurements at the time a post was assessed.",
      body: (
        <div className="space-y-2 text-xs">
          {Object.entries(FEATURE_DESCRIPTIONS).map(([feat, desc]) => (
            <div key={feat} className="rounded border p-2">
              <p className="font-mono font-semibold text-foreground">{feat}</p>
              <p className="text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    rounds: {
      title: `Boosting Rounds (${t.boosting_rounds ?? "Not trained yet"})`,
      subtitle: "Gradient boosted decision trees trained with early stopping on the validation split.",
      body: (
        <p className="text-xs text-muted-foreground">
          XGBoost trains up to 200 boosting rounds (`multi:softprob` across `POST`, `WAIT`, `HOLD`, `max_depth=4`, `eta=0.1`) with early stopping (`early_stopping_rounds=20`) evaluated on the chronological validation split, and guarded against the active model on the held-out test split.
        </p>
      ),
    },
  };

  return (
    <Dialog open={Boolean(stat)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{info[stat].title}</DialogTitle>
          <DialogDescription>{info[stat].subtitle}</DialogDescription>
        </DialogHeader>
        {info[stat].body}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

/** The XGBoost decision model: is it on, what it was trained on and what it weighs most. */
export default function ModelStatusCard() {
  const [selectedStat, setSelectedStat] = useState<StatKey | null>(null);
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
    <>
      <Card className="space-y-4 p-4 shadow-xs">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Mode" value={s.mode} hint="Shadow / Assist mode" onClick={() => setSelectedStat("mode")} />
          <Stat label="XGBoost" value={s.xgboost_installed ? (s.model_loaded ? "Loaded" : "Installed, no model") : "Not installed"} hint="Engine & auto-trainer" onClick={() => setSelectedStat("xgboost")} />
          <Stat label="Training rows" value={t.training_rows ?? "0 built"} hint="8 features per row" onClick={() => setSelectedStat("rows")} />
          <Stat label="Boosting rounds" value={t.boosting_rounds ?? "0"} hint="Up to 200 trees" onClick={() => setSelectedStat("rounds")} />
        </div>
        <p className="text-xs text-muted-foreground">
          {s.note || `Dataset ${t.dataset_version ?? "—"} · ${t.feature_count ?? "—"} features · classes: ${classes || "—"} · automatic retraining ${s.auto_training?.enabled ? "on" : "off"}`}
          {(s.error || s.load_error) && ` · ${s.error || s.load_error}`}
        </p>
        <FeatureImportance items={s.feature_importance ?? []} />
      </Card>
      <StatExplainDialog stat={selectedStat} data={s} onClose={() => setSelectedStat(null)} />
    </>
  );
}
