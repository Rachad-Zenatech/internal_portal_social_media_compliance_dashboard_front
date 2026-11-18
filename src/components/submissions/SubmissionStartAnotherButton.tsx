import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SubmissionStartAnotherButton() {
  const startAnother = () => window.location.assign("/submissions/new");
  return (
    <Button variant="outline" size="sm" className="text-xs gap-1.5 font-semibold" onClick={startAnother}>
      <FilePlus2 className="w-3.5 h-3.5" /> Start Another
    </Button>
  );
}
