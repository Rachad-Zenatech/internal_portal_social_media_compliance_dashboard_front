import ApprovedPostChecks from "@/components/submissions/ApprovedPostChecks";
import ApprovedPublishActions from "@/components/submissions/ApprovedPublishActions";

export default function ApprovedPostPublishing({ submissionId, canPublish, platform, intended }: {
  submissionId: string;
  canPublish: boolean;
  platform?: string;
  intended?: string | null;
}) {
  return (
    <>
      <ApprovedPostChecks submissionId={submissionId} canPublish={canPublish} />
      {canPublish && (
        <section className="border-t border-border/70 px-5 py-5">
          <ApprovedPublishActions key={`${submissionId}:${intended}`} submissionId={submissionId} platform={platform} intended={intended} />
        </section>
      )}
    </>
  );
}
