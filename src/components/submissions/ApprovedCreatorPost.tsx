import { useAuth } from "@/lib/AuthContext";
import { Link } from "react-router-dom";
import type { Submission } from "@/types/submission";
import { useImageSlideshow } from "@/hooks/useImageSlideshow";
import { authedFileUrl } from "./submissionUi";
import MarkedUpImageSlideshow from "./MarkedUpImageSlideshow";
import FormattedCaptionPreview from "./FormattedCaptionPreview";
import ReviewCommentsPanel from "./ReviewCommentsPanel";
import CreatorFlagOutcomes from "./CreatorFlagOutcomes";
import ApprovedPublishActions from "./ApprovedPublishActions";

/** A clean approval permits scheduling, not changes to the approved content. */
export default function ApprovedCreatorPost({ post }: { post: Submission }) {
  const { user } = useAuth();
  const ownsPost = user?.id === post.created_by;
  const slideshow = useImageSlideshow(post.files);
  const video = post.files.find(file => file.kind === "MAIN" && file.mime_type.startsWith("video/"));
  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <Link to="/submissions" className="text-sm text-primary underline">Back to my posts</Link>
      <header><h1 className="text-2xl font-bold">{post.title}</h1><p className="mt-1 text-sm text-muted-foreground">{post.reference_code} - Approved</p></header>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:bg-muted dark:text-foreground">
          <h2 className="font-semibold">Approved without changes</h2>
          <p className="mt-1 text-sm">Your approved text and files are locked. You do not need to rerun compliance or sentiment. Choose the final publishing date below.</p>
        </div>
        <MarkedUpImageSlideshow slideshow={slideshow} findings={[]} />
        {video && <video controls src={authedFileUrl(video.url)} className="mx-auto max-h-[60vh] max-w-full rounded-lg" />}
        <h2 className="font-semibold">Approved text</h2>
        <FormattedCaptionPreview html={post.caption_html ?? undefined} parts={[{ text: post.caption_text ?? "", tone: "" }]} />
      </section>
      <CreatorFlagOutcomes submissionId={post.id} currentVersion={post.current_version} />
      <section className="rounded-xl border bg-card p-5"><h2 className="mb-3 font-semibold">Reviewer comments</h2><ReviewCommentsPanel submissionId={post.id} canComment={false} /></section>
      {ownsPost && <section className="rounded-xl border bg-card p-5"><h2 className="mb-4 font-semibold">Schedule your post</h2><ApprovedPublishActions submissionId={post.id} platform={post.platforms[0]} intended={post.publish_at} /></section>}
    </main>
  );
}
