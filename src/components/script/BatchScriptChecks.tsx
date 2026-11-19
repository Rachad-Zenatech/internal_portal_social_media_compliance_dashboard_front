import type { ComponentProps } from "react";
import ScriptSourcesChecked from "./ScriptSourcesChecked";
import ScriptFindings from "./ScriptFindings";
import RuleCheckResults from "@/components/submissions/RuleCheckResults";

type Props = ComponentProps<typeof ScriptFindings> & { editable: boolean };

export default function BatchScriptChecks({ check, editable, ...actions }: Props) {
  if (!check) return null;
  return (
    <div className="space-y-3">
      <RuleCheckResults check={check} />
      <ScriptSourcesChecked check={check} />
      {editable && <ScriptFindings check={check} {...actions} />}
    </div>
  );
}
