import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { submissionService } from "@/services/submissionService";
import type { AiUsage } from "@/types/sentiment";
import ModelStatusCard from "./ModelStatusCard";
import MoodTrainingData from "./MoodTrainingData";

function CapacityMetric({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className={percent >= 90 ? "h-full bg-amber-500" : "h-full bg-primary"} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function AiCapacity({ usage }: { usage?: AiUsage }) {
  if (!usage) return null;
  const services = [
    ["PUBLIC_MOOD", "Public mood"],
    ["SENTIMENT", "Sentiment"],
    ["TRANSCRIPTION", "Transcription"],
    ["CAPTION", "Caption"],
  ] as const;
  return (
    <Card className="overflow-hidden py-0 shadow-xs">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">AI service capacity</h2>
        <span className="text-xs text-muted-foreground">Rolling 24-hour usage</span>
      </div>
      <Tabs defaultValue="PUBLIC_MOOD" className="gap-0">
        <div className="overflow-x-auto border-b border-border/70 px-2">
          <TabsList className="h-auto w-max min-w-full justify-start bg-transparent p-1">
            {services.map(([feature, label]) => (
              <TabsTrigger key={feature} value={feature} className="shrink-0">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {services.map(([feature, label]) => {
          const limit = usage[feature];
          const personalPercent = limit.limit ? Math.min(100, (limit.used / limit.limit) * 100) : 0;
          const companyPercent = limit.company_limit ? Math.min(100, (limit.company_used / limit.company_limit) * 100) : 0;
          return (
            <TabsContent key={feature} value={feature} className="m-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                <div>
                  <h3 className="font-semibold">{label}</h3>
                  <p className="text-sm text-muted-foreground">Service-specific capacity and shared tenant usage</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {limit.resets_at ? `Resets ${new Date(limit.resets_at).toLocaleString()}` : "Rolling 24-hour window"}
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <CapacityMetric label="Your usage" value={limit.limit ? `${limit.used} / ${limit.limit}` : `${limit.used} used`} percent={personalPercent} />
                <CapacityMetric label="Company usage" value={limit.company_limit ? `${limit.company_used} / ${limit.company_limit}` : `${limit.company_used} used`} percent={companyPercent} />
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Available to you</p>
                  <p className="mt-1 text-xl font-semibold">{limit.remaining === null ? "Unlimited" : limit.remaining}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{limit.remaining === null ? "No personal limit" : "runs remaining"}</p>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </Card>
  );
}

export default function TrainingDataPage() {
  const queryClient = useQueryClient();
  const aiUsage = useQuery({ queryKey: ["training-data", "ai-usage"], queryFn: () => submissionService.aiUsage() });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["training-data"] });
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4 pb-6 animate-in fade-in duration-300">
      <DashboardHeader
        title="XGBoost Training Data & Quality"
        subtitle="Inspect the XGBoost public-mood decision model, training readiness per decision class, reviewed posts & comments, and quick-open the video, image, or carousel content."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={refresh}>
            <RefreshCw className={aiUsage.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </Button>
        }
      />
      <ModelStatusCard />
      <MoodTrainingData />
      <AiCapacity usage={aiUsage.data} />
    </div>
  );
}
