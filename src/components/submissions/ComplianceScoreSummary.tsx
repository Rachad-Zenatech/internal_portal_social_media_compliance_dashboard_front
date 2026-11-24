import PendingDismissalScore from "@/components/submissions/PendingDismissalScore";

interface Props {
  score: number;
  minimumScore: number;
  heading: string;
  description: string;
  recalculatedScore?: number;
}

/** Keep the saved score prominent and show the separate pending-request calculation beneath it. */
export default function ComplianceScoreSummary({ score, minimumScore, heading, description, recalculatedScore }: Props) {
  const color = score >= minimumScore ? "#059669" : "#DC2626";
  const ringStyle = { background: `conic-gradient(${color} ${score * 3.6}deg, var(--muted) 0)` };
  const barStyle = { width: `${score}%`, background: color };
  const markerStyle = { left: `${minimumScore}%`, height: 18 };
  const labelStyle = { marginLeft: `${minimumScore - 4}%` };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border/60 bg-muted/30 p-4 sm:gap-6 sm:p-5">
        <span title={`Score ${score} out of 100`} style={ringStyle} className="grid h-24 w-24 shrink-0 place-items-center rounded-full">
          <span className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full bg-card leading-none">
            <span className="text-3xl font-extrabold tabular-nums text-foreground">{score}</span>
            <span className="mt-1 text-[11px] text-muted-foreground">of 100</span>
          </span>
        </span>
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
          <p className="text-base font-bold text-foreground">{heading}</p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          <div className="relative mt-1 h-2.5 rounded-full bg-muted">
            <span className="absolute left-0 top-0 h-2.5 rounded-full" style={barStyle} />
            <span className="absolute -top-1 h-4.5 w-0.5 bg-foreground" style={markerStyle} />
          </div>
          <span className="text-[11px] text-muted-foreground" style={labelStyle}>Minimum {minimumScore}</span>
        </div>
      </div>
      <PendingDismissalScore originalScore={score} recalculatedScore={recalculatedScore} minimumScore={minimumScore} />
    </div>
  );
}
