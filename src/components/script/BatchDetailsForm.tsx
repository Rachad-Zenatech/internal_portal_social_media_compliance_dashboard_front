import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import MultiSelectFilter from "@/components/ui/MultiSelectFilter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submissionService } from "@/services/submissionService";
import type { BatchDetails } from "@/types/scriptBatch";

/** An ISO time as the value of a datetime-local input (the viewer's own time zone), and back. */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const labelOf = (code: string) =>
  code.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/**
 * The details every post made from the batch shares: the same fields as a post's details. They are set once for the whole
 * batch, so each approved script becomes a post that is ready to film.
 */
export default function BatchDetailsForm({
  details,
  missing,
  disabled,
  onChange,
}: {
  details: BatchDetails;
  /** Details still empty, by name: those fields are outlined. */
  missing: string[];
  disabled?: boolean;
  onChange: (next: BatchDetails) => void;
}) {
  const optionsQuery = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 60_000 });
  const options = optionsQuery.data;
  const brands = useMemo(() => details.brand_codes ?? [], [details.brand_codes]);
  const reviewersQuery = useQuery({
    queryKey: ["submission-reviewers", [...brands].sort()],
    queryFn: () => submissionService.reviewers(brands),
    staleTime: 60_000,
  });

  const accountOptions = useMemo(
    () =>
      (options?.accounts ?? [])
        .filter((a) => brands.length === 0 || !a.brand_code || brands.includes(a.brand_code))
        .map((a) => ({ value: a.id, label: a.label })),
    [options, brands]
  );
  const audienceOptions = useMemo(
    () => Object.entries(options?.audiences ?? {}).map(([value, label]) => ({ value, label })),
    [options]
  );

  const wrong = (label: string) => (missing.includes(label) ? "ring-2 ring-destructive/60 rounded-md" : "");
  const trigger = "h-9 w-full justify-between bg-background";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5">
        <Label>Brand</Label>
        <div className={wrong("Brand")}>
          <MultiSelectFilter
            className={trigger}
            options={(options?.brands ?? []).map((b) => ({ value: b.code, label: b.name }))}
            value={brands}
            onChange={(v) => onChange({ ...details, brand_codes: v })}
            allLabel="Choose brands"
            noun="brand"
            ariaLabel="Brand"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Target audience</Label>
        <div className={wrong("Target audience")}>
          <MultiSelectFilter
            className={trigger}
            options={audienceOptions}
            value={details.audiences ?? []}
            onChange={(v) => onChange({ ...details, audiences: v })}
            allLabel="Choose audiences"
            noun="audience"
            ariaLabel="Target audience"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="batch-region">Region</Label>
        <select
          id="batch-region"
          disabled={disabled}
          value={details.region ?? ""}
          onChange={(e) => onChange({ ...details, region: e.target.value || null })}
          className={`h-9 w-full rounded-md border border-input bg-background px-2 text-sm ${wrong("Region")}`}
        >
          <option value="">Choose a region</option>
          {(options?.regions ?? []).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Platform(s)</Label>
        <div className={wrong("Platform(s)")}>
          <MultiSelectFilter
            className={trigger}
            options={(options?.platforms ?? []).map((p) => ({ value: p, label: labelOf(p) }))}
            value={details.platforms ?? []}
            onChange={(v) => onChange({ ...details, platforms: v })}
            allLabel="Choose platforms"
            noun="platform"
            ariaLabel="Platforms"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Publishing account(s)</Label>
        <div className={wrong("Publishing account(s)")}>
          <MultiSelectFilter
            className={trigger}
            options={accountOptions}
            value={details.account_ids ?? []}
            onChange={(v) => onChange({ ...details, account_ids: v })}
            allLabel="Choose accounts"
            noun="account"
            ariaLabel="Publishing accounts"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Rule sets</Label>
        <div className={wrong("Rule sets")}>
          <MultiSelectFilter
            className={trigger}
            options={(options?.rule_sets ?? []).map((r) => ({ value: r, label: labelOf(r) }))}
            value={details.rule_sets ?? []}
            onChange={(v) => onChange({ ...details, rule_sets: v })}
            allLabel="Choose rule sets"
            noun="rule set"
            ariaLabel="Rule sets"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Send to reviewers</Label>
        <div className={wrong("Send to reviewers")}>
          <MultiSelectFilter
            className={trigger}
            options={(reviewersQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
            value={details.reviewer_ids ?? []}
            onChange={(v) => onChange({ ...details, reviewer_ids: v })}
            allLabel="Choose reviewers"
            noun="reviewer"
            ariaLabel="Reviewers"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="batch-needed-by">Need approval by</Label>
        <Input
          id="batch-needed-by"
          type="datetime-local"
          disabled={disabled}
          value={toLocalInput(details.approval_needed_by)}
          onChange={(e) =>
            onChange({ ...details, approval_needed_by: e.target.value ? new Date(e.target.value).toISOString() : null })
          }
          className={wrong("Need approval by")}
        />
      </div>
    </div>
  );
}
