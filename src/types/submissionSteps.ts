/** The five steps a creator works through on a post. */
export type PostStepKey = "details" | "compliance" | "sentiment" | "mood" | "send";

/** done; stale (run before the post was last edited, so run it again); running; todo (not done yet). */
export type PostStepState = "done" | "stale" | "running" | "unavailable" | "todo";

/** How far a post has got through its steps (see the server's post_steps_service). */
export interface SubmissionSteps {
  details: PostStepState;
  compliance: PostStepState;
  sentiment: PostStepState;
  mood: PostStepState;
  send: PostStepState;
  revision?: boolean;
  suggestions?: PostStepState;
  next: PostStepKey | "suggestions" | null;
  ready_to_send: boolean;
  locked: boolean;
  /** What the details step still lacks, by field name. */
  missing: string[];
}
