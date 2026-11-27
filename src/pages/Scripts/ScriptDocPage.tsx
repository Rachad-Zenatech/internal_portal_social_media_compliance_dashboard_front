import ScriptDocWorkspace from "@/components/scriptdoc/ScriptDocWorkspace";
import { useParams } from "react-router-dom";

export default function ScriptDocPage() {
  const { id = "" } = useParams();
  return (
    <div className="space-y-3">
      <ScriptDocWorkspace key={id} scriptId={id} />
    </div>
  );
}
