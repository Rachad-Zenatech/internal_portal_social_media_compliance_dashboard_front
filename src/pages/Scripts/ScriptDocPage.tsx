import ScriptDocWorkspace from "@/components/scriptdoc/ScriptDocWorkspace";
import ScriptImportNotice from "@/components/scriptdoc/ScriptImportNotice";
import { useLocation, useParams } from "react-router-dom";

export default function ScriptDocPage() {
  const { id = "" } = useParams();
  const { state } = useLocation();
  const incoming = (state as { scriptImportWarnings?: unknown } | null)?.scriptImportWarnings;
  const warnings = Array.isArray(incoming) ? incoming.filter((message): message is string => typeof message === "string") : [];
  return (
    <div className="space-y-3">
      <ScriptImportNotice messages={warnings} />
      <ScriptDocWorkspace key={id} scriptId={id} />
    </div>
  );
}
