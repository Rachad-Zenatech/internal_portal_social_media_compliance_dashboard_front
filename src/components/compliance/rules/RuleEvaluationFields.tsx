import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  mode: "RULE" | "CONTEXT";
  onModeChange: (value: "RULE" | "CONTEXT") => void;
  guidance: string;
  onGuidanceChange: (value: string) => void;
}

export default function RuleEvaluationFields({ mode: formEvalMode, onModeChange: setFormEvalMode, guidance: formEvalGuidance, onGuidanceChange: setFormEvalGuidance }: Props) {
  return (
            <div className="rounded-lg border border-border/80 p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-foreground">How a match is judged</p>
                <p className="text-[11px] text-muted-foreground">
                  A hard rule flags its words every time: use it for bans and required disclaimers. A context rule treats a
                  match as a candidate; the AI reads the sentence around it and decides whether it is a violation, needs a
                  person to check something, needs a source, or isn't a breach (history, opinion, another subject).
                </p>
              </div>
              <div className="flex gap-2" role="radiogroup" aria-label="How a match is judged">
                {([
                  ['RULE', 'Hard rule'],
                  ['CONTEXT', 'Judge in context'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={formEvalMode === value}
                    onClick={() => setFormEvalMode(value)}
                    className={`h-8 rounded-md border px-3 text-xs font-medium ${
                      formEvalMode === value
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {formEvalMode === 'CONTEXT' && (
                <div className="space-y-1.5">
                  <Label htmlFor="eval-guidance" className="text-xs font-semibold">
                    What the judge must decide
                  </Label>
                  <Textarea
                    id="eval-guidance"
                    rows={4}
                    placeholder="Say when it is a violation, when it needs review, when it needs evidence and when it is fine. For example: a historical reference or a clearly framed opinion is fine; a present-tense claim about our own product is a violation."
                    value={formEvalGuidance}
                    onChange={(e) => setFormEvalGuidance(e.target.value)}
                    className="text-xs"
                  />
                  {!formEvalGuidance.trim() && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Without guidance the AI judges from the rule summary and examples alone.
                    </p>
                  )}
                </div>
              )}
            </div>
  );
}
