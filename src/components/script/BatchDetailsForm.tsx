import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { Field, MultiSelect } from "@/components/submissions/FormFields";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import { useAuth } from "@/lib/AuthContext";
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

/**
 * The details every post made from the batch shares: the same fields as a post's details, and they look and work the
 * same as on a new submission. They are set once for the whole batch, so each approved script becomes a post that is
 * ready to film.
 */
export default function BatchDetailsForm({
  details,
  missing,
  disabled,
  onChange,
}: {
  details: BatchDetails;
  /** Details still empty, by name (as the server names them): those fields are outlined in red. */
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
  // Nobody but a super admin reviews their own script, so the person uploading isn't offered as its reviewer.
  const { user, canSwitchView } = useAuth();
  const reviewers = (reviewersQuery.data ?? []).filter((r) => canSwitchView || r.id !== user?.id);
  const accounts = useMemo(
    () => (options?.accounts ?? []).filter((a) => brands.length === 0 || !a.brand_code || brands.includes(a.brand_code)),
    [options, brands]
  );
  const picked = details.account_ids ?? [];

  const isMissing = (name: string) => missing.includes(name);
  const error = (name: string, text: string) => isMissing(name) && text;

  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      <Field label="Brand(s)" required error={error("Brand", "Choose at least one brand")}>
        <MultiSelect<string>
          options={(options?.brands ?? []).map((b) => b.code)}
          value={brands}
          onChange={(v) => onChange({ ...details, brand_codes: v })}
          placeholder={options ? "Select brands" : "Loading..."}
          getLabel={(code) => options?.brands.find((b) => b.code === code)?.name ?? code}
          invalid={isMissing("Brand")}
        />
      </Field>
      <Field label="Target Audience(s)" required error={error("Target audience", "Choose at least one audience")}>
        <MultiSelect<string>
          options={Object.keys(options?.audiences ?? {})}
          value={details.audiences ?? []}
          onChange={(v) => onChange({ ...details, audiences: v })}
          placeholder={options ? "Select audiences" : "Loading..."}
          getLabel={(code) => options?.audiences[code] ?? code}
          invalid={isMissing("Target audience")}
        />
      </Field>
      <Field label="Region" required error={error("Region", "Choose a region")}>
        <Select value={details.region ?? ""} onValueChange={(v) => onChange({ ...details, region: v || null })} disabled={!options || disabled}>
          <SelectTrigger className={`h-11 w-full rounded-xl ${isMissing("Region") ? "border-red-500" : ""}`}>
            <SelectValue placeholder="Select region" />
          </SelectTrigger>
          <SelectContent>
            {(options?.regions ?? []).map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Platform(s)" required error={error("Platform(s)", "Choose at least one platform")}>
        <MultiSelect<string>
          options={options?.platforms ?? []}
          value={details.platforms ?? []}
          onChange={(v) => onChange({ ...details, platforms: v })}
          placeholder="Select platforms"
          getLabel={(p) => PLATFORM_LABELS[p as SocialPlatform] ?? p}
          renderIcon={(p) => <PlatformIcon platform={p as SocialPlatform} className="w-3.5 h-3.5" />}
          invalid={isMissing("Platform(s)")}
        />
      </Field>
      <Field label="Publishing Account(s)" required error={error("Publishing account(s)", "Choose at least one connected account")}>
        {options && accounts.length === 0 && picked.length === 0 ? (
          <div className={`flex h-11 items-center rounded-xl border px-3 text-sm text-muted-foreground ${isMissing("Publishing account(s)") ? "border-red-500" : "border-input"}`}>
            No connected accounts
          </div>
        ) : (
          <MultiSelect<string>
            // Keep accounts that were picked before a brand change filtered them out of the list.
            options={[...accounts.map((a) => a.id), ...picked.filter((id) => !accounts.some((a) => a.id === id))]}
            value={picked}
            onChange={(v) => onChange({ ...details, account_ids: v })}
            placeholder={options ? "Select accounts" : "Loading accounts..."}
            getLabel={(id) => {
              const a = options?.accounts.find((x) => x.id === id);
              return a ? `${a.label}${a.is_demo ? " · demo" : ""}` : "Disconnected account";
            }}
            renderIcon={(id) => {
              const a = options?.accounts.find((x) => x.id === id);
              return a ? <PlatformIcon platform={a.platform as SocialPlatform} className="w-3.5 h-3.5" /> : null;
            }}
            invalid={isMissing("Publishing account(s)")}
          />
        )}
      </Field>
      <Field label="Compliance Rule Set" required error={error("Rule sets", "Choose at least one rule set")}>
        <MultiSelect
          options={options?.rule_sets ?? []}
          value={details.rule_sets ?? []}
          onChange={(v) => onChange({ ...details, rule_sets: v })}
          placeholder="Select rule sets"
          compact
          invalid={isMissing("Rule sets")}
        />
      </Field>
      <Field label="Send to reviewers" required error={error("Send to reviewers", "Pick at least one reviewer")}>
        {reviewersQuery.isSuccess && reviewers.length === 0 ? (
          <div className={`flex h-11 items-center rounded-xl border px-3 text-sm text-muted-foreground ${isMissing("Send to reviewers") ? "border-red-500" : "border-input"}`}>
            No reviewers yet{brands.length ? ` for ${brands.length === 1 ? "this brand" : "these brands"}` : ""}
          </div>
        ) : (
          <MultiSelect<string>
            options={reviewers.map((r) => r.id)}
            value={details.reviewer_ids ?? []}
            onChange={(v) => onChange({ ...details, reviewer_ids: v })}
            placeholder={reviewersQuery.isLoading ? "Loading reviewers..." : reviewersQuery.isError ? "Couldn't load reviewers" : "Pick reviewers"}
            getLabel={(id) => {
              const r = reviewers.find((x) => x.id === id);
              return r ? `${r.name}${r.is_super_admin ? " · Super admin" : ""}${r.kind === "SUGGESTER" ? " · Suggests only" : ""}` : "Reviewer";
            }}
            getSearchText={(id) => reviewers.find((x) => x.id === id)?.email ?? ""}
            renderIcon={() => <Users className="w-3.5 h-3.5 text-muted-foreground" />}
            invalid={isMissing("Send to reviewers")}
            searchable
            selectAll
          />
        )}
      </Field>
      <Field label="Need approval by" required error={error("Need approval by", "Pick a date in the future")}>
        <DateTimePicker
          id="batch-needed-by"
          withTime
          disablePast
          disabled={disabled}
          value={toLocalInput(details.approval_needed_by)}
          onChange={(v) => onChange({ ...details, approval_needed_by: v ? new Date(v).toISOString() : null })}
          className={`h-11 rounded-xl ${isMissing("Need approval by") ? "border-red-500" : ""}`}
        />
      </Field>
    </fieldset>
  );
}
