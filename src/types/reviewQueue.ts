import type { AccountOption, AnalysisProgress, ContentType, DueKind, StoredCheck, SubmissionFile, SubmissionStatus } from "./submission";
import type { ScriptStatus } from "./script";
import type { ReviewScoreFields } from "./reviewScore";
import type { PostApprovalSuggestionFields } from "./postApprovalSuggestions";

export interface ReviewQueueItem extends ReviewScoreFields, PostApprovalSuggestionFields {
  /** Video posts with a script stage: where the script is (to link to it). */
  script_status?: ScriptStatus | null;
  id: string;
  reference_code: string;
  title: string;
  status: SubmissionStatus;
  publish_after_changes?: boolean;
  platforms: string[];
  account?: AccountOption | null;
  caption_text?: string | null;
  /** Platforms with their own caption (plain text); the others use caption_text. */
  platform_captions?: Record<string, string>;
  /** Every account it posts through. */
  accounts?: AccountOption[];
  latest_check?: StoredCheck | null;
  /** While the check is still reading the post: what's left and when the score is expected. */
  analysis_progress?: AnalysisProgress | null;
  current_version: number;
  submitted_at?: string | null;
  creator_name?: string | null;
  content_type?: ContentType | null;
  /** The post's video, when it has one. */
  video?: SubmissionFile | null;
  /** Its images in order (carousel slides first, then extras such as a cover). */
  images?: SubmissionFile[];
  can_review?: boolean;
  /** Final approvers named by an approval path; empty means any reviewer on the brand. */
  approver_names?: string[];
  /** The viewer may approve it (a reviewer, and one of its named approvers when it has any). */
  can_approve?: boolean;
  /** In review and the viewer may hand it to another reviewer. */
  can_delegate?: boolean;
  /** Who it was sent to, including anyone it was delegated to. */
  reviewer_ids?: string[];
  /** Critical flags on the current version that no reviewer has dismissed; approval waits on these. */
  open_critical_flags?: number;
  publish_at?: string | null;
  brand_code?: string | null;
  audience?: string | null;
  /** Every brand it's for and audience it targets, primary first (brand_code and audience are the first). */
  brand_codes?: string[];
  audiences?: string[];
  /** When the creator needs it approved by. */
  approval_needed_by?: string | null;
  /** When the next step is due (see DueKind). */
  due_at?: string | null;
  due_kind?: DueKind | null;
  created_by?: string | null;
  /** Approved: the viewer is a reviewer who may reschedule or reopen it. */
  can_manage_approval?: boolean;
  /** When the latest version was approved or sent back. */
  decided_at?: string | null;
}
