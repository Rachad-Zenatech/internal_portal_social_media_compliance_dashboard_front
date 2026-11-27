import PrePublishMood from "@/components/submissions/PrePublishMood";

export default function ApprovedPostChecks({ submissionId, canPublish }: { submissionId: string; canPublish: boolean }) {
  return (
    <section className="space-y-4 border-t border-border/70 px-5 py-5">
      <p className="text-sm text-muted-foreground">The approved content is locked. You can choose its publishing date without rerunning compliance or sentiment.</p>
      <PrePublishMood submissionId={submissionId} canRun={canPublish} />
    </section>
  );
}
