import { CHECKING_METHOD_LABELS, type CheckingMethod } from "@/types/ruleCheck";
import RuleEvaluationFields from "./RuleEvaluationFields";

interface Props {
  methods: CheckingMethod[];
  onMethodsChange: (value: CheckingMethod[]) => void;
  mode: "RULE" | "CONTEXT";
  onModeChange: (value: "RULE" | "CONTEXT") => void;
  guidance: string;
  onGuidanceChange: (value: string) => void;
}

function MethodOption({ method, checked, onChange }: { method: CheckingMethod; checked: boolean; onChange: () => void }) {
  return <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><input type="checkbox" checked={checked} onChange={onChange} className="accent-primary" />{CHECKING_METHOD_LABELS[method]}</label>;
}

export function RuleMethodBadges({ methods = [] }: { methods?: CheckingMethod[] }) {
  if (!methods.length) return <span className="text-[11px] text-amber-700">Checking method not configured</span>;
  return <span className="flex flex-wrap gap-1">{methods.map((method) => <span key={method} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{CHECKING_METHOD_LABELS[method]}</span>)}</span>;
}

export default function RuleCheckingFields({ methods, onMethodsChange, mode, onModeChange, guidance, onGuidanceChange }: Props) {
  const toggle = (method: CheckingMethod) => () => onMethodsChange(methods.includes(method) ? methods.filter((item) => item !== method) : [...methods, method]);
  return (
    <section className="space-y-4">
      <fieldset className="space-y-2"><legend className="text-xs font-semibold">Checking methods *</legend><p className="text-[11px] text-muted-foreground">Select every method this rule requires. Human confirmation is configured deliberately; it is never inferred from an empty phrase list.</p><div className="grid gap-2 sm:grid-cols-2">{(Object.keys(CHECKING_METHOD_LABELS) as CheckingMethod[]).map((method) => <MethodOption key={method} method={method} checked={methods.includes(method)} onChange={toggle(method)} />)}</div>{methods.length === 0 && <p className="text-[11px] text-amber-700">Choose at least one checking method before saving.</p>}</fieldset>
      <RuleEvaluationFields mode={mode} onModeChange={onModeChange} guidance={guidance} onGuidanceChange={onGuidanceChange} />
    </section>
  );
}
