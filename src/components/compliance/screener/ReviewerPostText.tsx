import type { ComponentProps } from "react";
import MarkedReviewerCaption from "./MarkedReviewerCaption";
import ReviewerCaption from "./ReviewerCaption";
import PostTextReview from "@/components/submissions/PostTextReview";
import PlatformCaptionsView from "@/components/submissions/PlatformCaptionsView";
import type { ReviewQueueItem } from "@/types/submission";

export default function ReviewerPostText({ post, canComment, captionProps }: {
  post: ReviewQueueItem; canComment: boolean;
  captionProps: Omit<ComponentProps<typeof MarkedReviewerCaption>, "text" | "html">;
}) {
  const renderCaption = (text: string, html: string | null | undefined, showFlags: boolean) => (
    <MarkedReviewerCaption {...captionProps} text={text} html={html} terms={showFlags ? captionProps.terms : []} />
  );
  return (
    <>
      {post.content_type === "TEXT_POST" ? <>
        {renderCaption(post.caption_text ?? "", null, true)}
        <PostTextReview key={post.id} submissionId={post.id} allowEdit={canComment} />
      </> : <ReviewerCaption key={`${post.id}:${post.current_version}`} submissionId={post.id} canComment={canComment} captionText={post.caption_text ?? ""}>{renderCaption}</ReviewerCaption>}
      <PlatformCaptionsView platforms={post.platforms} captions={post.platform_captions} mainCaption={post.caption_text} />
    </>
  );
}
