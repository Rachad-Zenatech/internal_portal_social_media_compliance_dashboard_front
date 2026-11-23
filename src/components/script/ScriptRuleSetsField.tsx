import { useEffect, useMemo } from "react";
import { Field, MultiSelect } from "@/components/submissions/FormFields";
import { resolveRuleSets, ruleSetOptions } from "@/lib/ruleSetPolicy";
import type { BatchDetails } from "@/types/scriptBatch";

/** Script rule sets use the post policy and are saved with the rest of the details. */
export default function ScriptRuleSetsField({ details, options, disabled, onChange }: {
  details: BatchDetails;
  options: string[];
  disabled?: boolean;
  onChange: (next: BatchDetails) => void;
}) {
  const selected = useMemo(() => resolveRuleSets(details.brand_codes ?? [], details.audiences ?? [], details.rule_sets ?? []),
    [details.brand_codes, details.audiences, details.rule_sets]);
  const choices = ruleSetOptions(options, details.brand_codes ?? [], details.audiences ?? []);
  const value = disabled ? details.rule_sets ?? [] : selected;
  useEffect(() => {
    if (!disabled && JSON.stringify(selected) !== JSON.stringify(details.rule_sets ?? [])) {
      onChange({ ...details, rule_sets: selected });
    }
  }, [details, disabled, onChange, selected]);
  const change = (next: string[]) => onChange({ ...details,
    rule_sets: resolveRuleSets(details.brand_codes ?? [], details.audiences ?? [], next) });
  return (
    <Field label="Compliance Rule Set" required>
      <MultiSelect options={choices} value={value} onChange={change} placeholder="Select rule sets" compact />
      <p className="text-xs text-muted-foreground">Required rule sets follow the selected brand and audience.</p>
    </Field>
  );
}
