import type { PostStepKey, PostStepState, SubmissionSteps } from "@/types/submission";

/**
 * The five steps a creator works through, in order. `purpose` is what a hover on the step says it is for.
 * Steps 2 to 4 are tools for the creator, to improve the post before a reviewer sees it.
 */
export const POST_STEPS: { key: PostStepKey; label: string; purpose: string }[] = [
  {
    key: "details",
    label: "Post details",
    purpose: "Fill in the post: title, brands, audience, accounts, caption and media.",
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
    key: "mood",
    label: "Public mood",
    purpose: "See what people online are saying about your post's topics, and whether now is a good time to post.",
  },
  {
    key: "send",
    label: "Send for review",
    purpose: "Pick your reviewers and send it. Once it is sent the post is locked.",
  },
];

/** Where each step opens. Every step of a post is a page of its own; the editor reads ?step= to land on the right one. */
export function stepPath(id: string, step: PostStepKey): string {
  return `/submissions/new?id=${id}&step=${step}`;
}

export function isStepKey(value: string | null): value is PostStepKey {
  return POST_STEPS.some((s) => s.key === value);
}

/** Where a click on the post itself goes: the step it was left on, or (once sent) the read-only post. */
export function resumePath(id: string, steps?: SubmissionSteps | null): string {
  if (!steps || steps.locked || !steps.next) return `/submissions/new?id=${id}`;
  return stepPath(id, steps.next);
}

/**
 * Steps 2 to 4 as the progress dots show them: done once they have run at least once, even if the post changed since.
 * Running them again after an edit is asked for in the compliance step and when sending, not on the dots.
 */
export function ranOnce(steps: SubmissionSteps): SubmissionSteps {
  if (steps.locked) return steps;
  const ran = (s: PostStepState): PostStepState => (s === "stale" ? "done" : s);
  const out = { ...steps, compliance: ran(steps.compliance), sentiment: ran(steps.sentiment), mood: ran(steps.mood) };
  const next = (["details", "compliance", "sentiment", "mood"] as const).find((k) => out[k] !== "done") ?? "send";
  return { ...out, next, ready_to_send: next === "send" };
}

/** What a step is up to, as a sentence for the hover. */
export function stepStatusText(key: PostStepKey, state: PostStepState, steps: SubmissionSteps): string {
  if (steps.locked) return "Sent for review. It is locked: you can look, but not change it or run it again.";
  if (key === "send") {
    return steps.ready_to_send ? "Ready: every step is done." : "Locked until steps 1 to 4 are done.";
  }
  if (key === "details" && state === "todo" && steps.missing.length) return "Not finished yet.";
  switch (state) {
    case "done":
      return key === "details" ? "Done." : "Done and up to date.";
    case "stale":
      return "Out of date: the post changed after this ran. Run it again.";
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
  caption: "caption",
  main_file: "media",
  script_approval: "an approved script",
};

export function missingText(missing: string[]): string {
  const words = missing.map((m) => FIELD_WORDS[m] ?? m);
  return words.length ? `Still needed: ${words.join(", ")}.` : "";
}
