import type { PostStepKey } from "@/types/submission";

export const STEP_TITLE: Record<PostStepKey, string> = {
  details: "Post details",
  compliance: "Compliance rules",
  sentiment: "Sentiment analysis",
  mood: "Public mood",
  send: "Send for review",
};
export const STEP_DESCRIPTION: Record<PostStepKey, string> = {
  details: "",
  compliance: "Check your post against the rulebook yourself. Edit and check again as often as you like.",
  sentiment: "How the tone and messaging may land with your audience. Edit and run it again as often as you like.",
  mood: "",
  send: "Pick your reviewers and send it. Once it is sent the post is locked.",
};

export type EditorStep = PostStepKey | "suggestions";

const REVISION_STEPS: { key: EditorStep; label: string; purpose: string }[] = [
  { key: "suggestions", label: "Check the suggestions", purpose: "Read what the reviewers said and see where each comment is on the post. Reply to any of them." },
  { key: "details", label: "Make the changes", purpose: "Change the post as asked: upload a new image, video or script, and edit the text. The reviewed basics stay locked." },
  { key: "compliance", label: "Compliance", purpose: "Check the changed post against the rulebook again." },
  { key: "sentiment", label: "Sentiment", purpose: "Run the sentiment analysis again on the changed post." },
  { key: "send", label: "Reviewers", purpose: "The reviewers stay on the post. Add more people if you like, then resubmit." },
];

/** Every revision starts with feedback; only explicitly authorized revisions end at Publish. */
export function submissionRevisionSteps(scriptOnly: boolean, publishAfterChanges: boolean) {
  return REVISION_STEPS.filter((step) => !scriptOnly || step.key !== "sentiment").map((step) =>
    publishAfterChanges && step.key === "send"
      ? { ...step, label: "Publish", purpose: "Publish the corrected post directly; it will not return to review." }
      : step
  );
}
