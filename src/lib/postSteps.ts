import type { PostStepKey, PostStepState, SubmissionSteps } from "@/types/submission";

export const RAN_STEP_STATES: ReadonlySet<PostStepState> = new Set(["done", "stale", "unavailable"]);

/**
 * The four steps a creator works through, in order. `purpose` is what a hover on the step says it is for.
 * Steps 2 and 3 are tools for the creator, to improve the post before a reviewer sees it.
 */
export const POST_STEPS: { key: PostStepKey; label: string; purpose: string }[] = [
  {
    key: "details",
    label: "Post details",
    purpose: "Fill in the post: title, brands, audience, accounts, text and media.",
  },
  {
    key: "compliance",
    label: "Compliance rules",
    purpose: "Check the post against the rulebook, see your score and what to fix, before a reviewer does.",
  },
  {
    key: "sentiment",
    label: "Sentiment analysis",
    purpose: "See how the tone and messaging may land with your audience, and any reputational risk.",
  },
  {
    key: "send",
    label: "Send for review",
    purpose: "Pick your reviewers and send it. Once it is sent the post is locked.",
  },
];

/** The server marks checks stale only after media changes. Those changes require a rerun. */
export const RECHECK_AFTER_EDITS = true;

/** Scripts use compliance only; sentiment becomes available when the video is attached. */
export function postPreparationSteps(scriptOnly = false) {
  return POST_STEPS.filter((step) => !scriptOnly || step.key !== "sentiment");
}


/** Where each step opens. Every step of a post is a page of its own; the editor reads ?step= to land on the right one. */
export function stepPath(id: string, step: PostStepKey | "suggestions"): string {
  return `/submissions/new?id=${id}&step=${step}`;
}

export function isStepKey(value: string | null): value is PostStepKey {
  return POST_STEPS.some((s) => s.key === value);
}

/** Where a click on the post itself goes: the step it was left on, or (once sent) the read-only post. */
export function resumePath(id: string, steps?: SubmissionSteps | null): string {
  if (!steps || steps.locked || !steps.next) return `/submissions/new?id=${id}`;
  return stepPath(id, steps.next === "mood" ? "send" : steps.next);
}

/** Normalize progress without hiding stale media checks. Kept under its existing export for callers. */
export function ranOnce(steps: SubmissionSteps, scriptOnly = false): SubmissionSteps {
  if (steps.locked) return steps;
  const out = { ...steps };
  const next = postPreparationSteps(scriptOnly).find((step) => step.key !== "send" && out[step.key] !== "done")?.key ?? "send";
  return { ...out, next, ready_to_send: next === "send" };
}

/** What a step is up to, as a sentence for the hover. */
export function stepStatusText(key: PostStepKey | "suggestions", state: PostStepState, steps: SubmissionSteps): string {
  if (steps.locked) return "Sent for review. It is locked: you can look, but not change it or run it again.";
  if (key === "suggestions") return state === "done" ? "Feedback addressed." : "Read and address the reviewer feedback.";
  if (key === "send" && state === "done") return "Sent for review.";
  if (key === "send") {
    return steps.ready_to_send ? "Ready: every step is done." : "Available once the earlier steps are complete.";
  }
  if (key === "details" && state === "todo" && steps.missing.length) return "Not finished yet.";
  switch (state) {
    case "done":
      return key === "details" ? "Done." : "Done and up to date.";
    case "stale":
      return "Out of date: the media changed after this ran. Run it again.";
    case "unavailable":
      return "The check ran, but the AI review was interrupted. Run it again to get a score.";
    case "running":
      return "Running now.";
    default:
      return key === "details" ? "Not finished yet." : "Not run yet.";
  }
}

/** The names of the details still missing, in words, for the hover on the details step. */
const FIELD_WORDS: Record<string, string> = {
  title: "title",
  brand_code: "brand",
  audience: "audience",
  region: "region",
  platforms: "platform",
  account_id: "account",
  rule_sets: "rule set",
  caption: "text",
  main_file: "media",
  ai_generated_images: "answer to the AI image question",
  script_approval: "an approved script",
};

export function missingText(missing: string[]): string {
  const words = missing.map((m) => FIELD_WORDS[m] ?? m);
  return words.length ? `Still needed: ${words.join(", ")}.` : "";
}
