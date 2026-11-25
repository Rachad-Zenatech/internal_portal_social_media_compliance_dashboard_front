import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { CheckAttempt } from "@/types/checkAttempt";
import { groups, outcome, relation, stepLabel, summary, taskLabel } from "./checkProgressPresentation";

function AttemptRow({ attempt, retry }: { attempt: CheckAttempt; retry: string | null }) {
  const Icon = attempt.status === "RUNNING" ? Loader2 : attempt.status === "OK" ? CheckCircle2 : XCircle;
  const color = attempt.status === "RUNNING" ? "animate-spin text-blue-600" : attempt.status === "OK" ? "text-emerald-600" : "text-red-600";
  return (
    <li className="flex items-start gap-2 py-1 text-xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
      <div className="min-w-0 space-y-0.5">
        <p className="break-words font-medium text-foreground">{taskLabel(attempt)} {retry && <span className="text-amber-700">({retry})</span>}</p>
        <p className="text-muted-foreground">{outcome(attempt)}</p>
        <p className="break-all text-[10px] text-muted-foreground">Model: {attempt.model}</p>
      </div>
    </li>
  );
}

function StepAttempts({ feature, attempts }: { feature: string; attempts: CheckAttempt[] }) {
  const counts = summary(attempts);
  const running = attempts.filter(a => a.status === "RUNNING");
  const finished = attempts.filter(a => a.status !== "RUNNING");
  const statuses = [counts.completed ? `${counts.completed} completed` : "", counts.running ? `${counts.running} in progress` : "",
    counts.failed ? `${counts.failed} unsuccessful` : ""].filter(Boolean).join(", ");
  const rows = (items: CheckAttempt[]) => items.map(a => <AttemptRow key={a.id} attempt={a} retry={relation(attempts, attempts.indexOf(a))} />);
  return (
    <section className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{stepLabel(feature)}</p>
      <p className="text-[11px] text-muted-foreground" role="status">{statuses}</p>
      {feature === "SOURCE_CHECK" && <p className="text-[11px] text-muted-foreground">Separate checks identify claims and compare them with relevant sources. The same model can handle several checks.</p>}
      {running.length > 0 && <ul>{rows(running)}</ul>}
      {finished.length > 0 && <details className="text-[11px] text-muted-foreground"><summary className="cursor-pointer py-1">View completed requests and errors ({finished.length})</summary><ul>{rows(finished)}</ul></details>}
    </section>
  );
}

export function AttemptList({ attempts }: { attempts: CheckAttempt[] }) {
  const steps = groups(attempts);
  return <div className="space-y-3">{steps.map(step => <StepAttempts key={step.feature} {...step} />)}</div>;
}
