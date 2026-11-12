import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { Field, MultiSelect } from "@/components/submissions/FormFields";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import type { BatchDetails } from "@/types/scriptBatch";

/**
 * Who a batch goes to: reviewers who approve, and (optionally) suggesting reviewers. Both are picked in their own box and end
 * up in the one list of reviewer ids the server takes. They are the reviewers of the brands picked in the details.
 */
export default function BatchReviewerFields({
  details,
  missing,
  onChange,
}: {
  details: BatchDetails;
  missing: string[];
  onChange: (next: BatchDetails) => void;
}) {
  const brands = details.brand_codes ?? [];
  const reviewersQuery = useQuery({
    queryKey: ["submission-reviewers", [...brands].sort()],
    queryFn: () => submissionService.reviewers(brands),
    staleTime: 60_000,
  });
  // Nobody but a super admin reviews their own script, so the person uploading isn't offered as its reviewer.
  const { user, canSwitchView } = useAuth();
  const reviewers = (reviewersQuery.data ?? []).filter((r) => canSwitchView || r.id !== user?.id);
  const approvers = reviewers.filter((r) => r.kind !== "SUGGESTER");
  const suggesters = reviewers.filter((r) => r.kind === "SUGGESTER");
  const pickedAll = details.reviewer_ids ?? [];
  const pickedApprovers = pickedAll.filter((id) => approvers.some((r) => r.id === id));
  const pickedSuggesters = pickedAll.filter((id) => suggesters.some((r) => r.id === id));
  const isMissing = missing.includes("Send to reviewers");

  return (
    <>
      <Field label="Send to reviewers" required error={isMissing && "Pick at least one reviewer"}>
        {reviewersQuery.isSuccess && approvers.length === 0 ? (
          <div className={`flex h-11 items-center rounded-xl border px-3 text-sm text-muted-foreground ${isMissing ? "border-red-500" : "border-input"}`}>
            No reviewers yet{brands.length ? ` for ${brands.length === 1 ? "this brand" : "these brands"}` : ""}
          </div>
        ) : (
          <MultiSelect<string>
            options={approvers.map((r) => r.id)}
            value={pickedApprovers}
            onChange={(v) => onChange({ ...details, reviewer_ids: [...v, ...pickedSuggesters] })}
            placeholder={reviewersQuery.isLoading ? "Loading reviewers..." : reviewersQuery.isError ? "Couldn't load reviewers" : "Pick reviewers"}
            getLabel={(id) => {
              const r = approvers.find((x) => x.id === id);
              return r ? `${r.name}${r.is_super_admin ? " · Super admin" : ""}` : "Reviewer";
            }}
            getSearchText={(id) => approvers.find((x) => x.id === id)?.email ?? ""}
            renderIcon={() => <Users className="w-3.5 h-3.5 text-muted-foreground" />}
            invalid={isMissing}
            searchable
            selectAll
          />
        )}
      </Field>
      {suggesters.length > 0 && (
        <Field label="Suggesting reviewers (optional)">
          <MultiSelect<string>
            options={suggesters.map((r) => r.id)}
            value={pickedSuggesters}
            onChange={(v) => onChange({ ...details, reviewer_ids: [...pickedApprovers, ...v] })}
            placeholder="Pick suggesting reviewers"
            getLabel={(id) => suggesters.find((x) => x.id === id)?.name ?? "Reviewer"}
            getSearchText={(id) => suggesters.find((x) => x.id === id)?.email ?? ""}
            renderIcon={() => <Users className="w-3.5 h-3.5 text-muted-foreground" />}
            searchable
            selectAll
          />
        </Field>
      )}
    </>
  );
}
