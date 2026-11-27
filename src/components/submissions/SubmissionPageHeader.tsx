import { Loader2 } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import SubmissionStartAnotherButton from "./SubmissionStartAnotherButton";

export default function SubmissionPageHeader({ referenceCode, submissionId }: { referenceCode: string | null; submissionId: string | null }) {
  const title = referenceCode ? "Edit Submission" : "New Submission";
  const description = "Create a new content submission for compliance review and approval.";
  const subtitle = referenceCode ? `${referenceCode} - ${description}` : description;
  return <DashboardHeader title={title} subtitle={subtitle} actions={submissionId ? <SubmissionStartAnotherButton /> : undefined} />;
}

export function LoadingSubmission() {
  return <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading post...</div>;
}
