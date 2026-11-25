import { StepFooter } from "./PostStepNav";
import PostTextReview from "./PostTextReview";

export default function SubmissionReviewUpdates({ suggestions, textOnly, submissionId, onContinue }: {
  suggestions: boolean; textOnly: boolean; submissionId: string | null; onContinue: () => void;
}) {
  return (
    <>
      {suggestions && <StepFooter next={{ label: "Continue to make the changes", onClick: onContinue }} />}
      {textOnly && submissionId && <PostTextReview submissionId={submissionId} />}
    </>
  );
}
