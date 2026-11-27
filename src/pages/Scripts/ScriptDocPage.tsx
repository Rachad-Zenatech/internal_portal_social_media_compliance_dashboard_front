import ScriptDocWorkspace from "@/components/scriptdoc/ScriptDocWorkspace";
import { useParams } from "react-router-dom";

export default function ScriptDocPage() {
  const { id = "" } = useParams();
  return <ScriptDocWorkspace key={id} scriptId={id} />;
}
