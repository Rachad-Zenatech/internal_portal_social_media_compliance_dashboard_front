import { Lock, Users } from "lucide-react";

import { Field, MultiSelect } from "@/components/submissions/FormFields";
import type { ReviewerOption } from "@/types/submission";

/**
 * Who a post goes to: the reviewers who can approve it and, in their own box, suggesting reviewers (who can comment and
 * suggest edits). A post sent back for changes keeps the people who asked for them (`locked`): more can be added.
 */
export default function ReviewerPicker({
  approvers,
  suggesters,
  locked,
  pickedApprovers,
  pickedSuggesters,
  onChange,
  status,
  brandCount,
  invalid,
  error,
}: {
  approvers: ReviewerOption[];
  suggesters: ReviewerOption[];
  /** Already on the post, and staying on it. */
  locked: string[];
  pickedApprovers: string[];
  pickedSuggesters: string[];
  /** The whole list of people picked (locked ones included). */
  onChange: (ids: string[]) => void;
  status: { isSuccess: boolean; isLoading: boolean; isError: boolean };
  brandCount: number;
  invalid: boolean;
  error: string | false;
}) {
  const open = (list: ReviewerOption[]) => list.map((r) => r.id).filter((id) => !locked.includes(id));
  const nobody = status.isSuccess && approvers.length === 0;
  return (
    <>
      {locked.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground">Already reviewing</p>
          <ul className="flex flex-wrap gap-1.5">
            {locked.map((id) => {
              const r = [...approvers, ...suggesters].find((x) => x.id === id);
              return (
                <li key={id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  {r?.name ?? "A reviewer"}
                  <span className="text-muted-foreground">{r?.kind === "SUGGESTER" ? "· Suggesting" : "· Reviewer"}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-muted-foreground">They asked for these changes, so they stay on the post. You can add more people below.</p>
        </div>
      )}
      <Field label={locked.length ? "Add reviewers (optional)" : "Send to reviewers"} required={locked.length === 0} error={error}>
        {nobody ? (
          <div className={`flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground ${invalid ? "border-red-500" : "border-input"}`}>
            No reviewers yet{brandCount ? ` for ${brandCount === 1 ? "this brand" : "these brands"}` : ""}
          </div>
        ) : (
          <MultiSelect<string>
            options={open(approvers)}
            value={pickedApprovers.filter((id) => !locked.includes(id))}
            onChange={(ids) => onChange([...new Set([...locked, ...ids, ...pickedSuggesters])])}
            placeholder={status.isLoading ? "Loading reviewers..." : status.isError ? "Couldn't load reviewers" : locked.length ? "Add another reviewer" : "Pick reviewers"}
            getLabel={(id) => {
              const r = approvers.find((x) => x.id === id);
              return r ? `${r.name}${r.is_super_admin ? " · Super admin" : ""}` : "Reviewer";
            }}
            getSearchText={(id) => approvers.find((x) => x.id === id)?.email ?? ""}
            renderIcon={() => <Users className="w-3.5 h-3.5 text-muted-foreground" />}
            invalid={invalid}
            searchable
            selectAll
          />
        )}
        <p className="text-[11px] text-muted-foreground">
          {nobody
            ? "Add users and give them a reviewer role (System & Security) to send them content."
            : "Only the people you pick see this post and get its notifications. Final approvers for its brands are always included."}
        </p>
      </Field>
      {open(suggesters).length > 0 && (
        <Field label={locked.length ? "Add suggesting reviewers (optional)" : "Suggesting reviewers (optional)"}>
          <MultiSelect<string>
            options={open(suggesters)}
            value={pickedSuggesters.filter((id) => !locked.includes(id))}
            onChange={(ids) => onChange([...new Set([...locked, ...pickedApprovers, ...ids])])}
            placeholder="Pick suggesting reviewers"
            getLabel={(id) => suggesters.find((x) => x.id === id)?.name ?? "Reviewer"}
            getSearchText={(id) => suggesters.find((x) => x.id === id)?.email ?? ""}
            renderIcon={() => <Users className="w-3.5 h-3.5 text-muted-foreground" />}
            searchable
            selectAll
          />
          <p className="text-[11px] text-muted-foreground">
            They can read the post, leave comments and suggest edits to the script. They can&apos;t approve or schedule it.
          </p>
        </Field>
      )}
    </>
  );
}
