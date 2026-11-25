import type { ReactNode } from "react";
import ReviewerCaption from "./ReviewerCaption";
import PostTextReview from "@/components/submissions/PostTextReview";
import PlatformCaptionsView from "@/components/submissions/PlatformCaptionsView";
import type { ReviewQueueItem } from "@/types/submission";

export default function ReviewerPostText({ post, canComment, children }: {
  post: ReviewQueueItem; canComment: boolean;
  children: (text: string, html: string | null | undefined, showFlags: boolean) => ReactNode;
}) {
  return (
    <>
      {post.content_type === "TEXT_POST" ? <>
        {children(post.caption_text ?? "", null, true)}
        <PostTextReview key={post.id} submissionId={post.id} allowEdit={canComment} />
      </> : <ReviewerCaption key={`${post.id}:${post.current_version}`} submissionId={post.id} canComment={canComment} captionText={post.caption_text ?? ""}>{children}</ReviewerCaption>}
      <PlatformCaptionsView platforms={post.platforms} captions={post.platform_captions} mainCaption={post.caption_text} />
    </>
  );
}
