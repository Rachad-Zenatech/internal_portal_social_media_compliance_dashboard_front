import { AtSign, Hash, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readSignals } from "@/lib/postSignals";

const DISCLOSURE_RULE_SET = "Public Company Disclosure";

/**
 * Live feedback under the caption: the hashtags, cashtags and mentions in it, whether there are more hashtags than
 * the platforms suit, and, when the caption carries the company cashtag, that investor-disclosure rules apply (with
 * a one-click fix if that rule set isn't selected).
 */
export default function CaptionSignalsBar({
  caption,
  maxHashtags,
  maxReason,
  ruleSets,
  onAddRuleSet,
}: {
  caption: string;
  maxHashtags: number | null;
  maxReason?: string | null;
  ruleSets: string[];
  onAddRuleSet: (ruleSet: string) => void;
}) {
  const { cashtags, hashtags, mentions } = readSignals(caption);
  if (!cashtags.length && !hashtags.length && !mentions.length) return null;

  const over = maxHashtags != null && hashtags.length > maxHashtags;
  const needsDisclosure = cashtags.length > 0 && !ruleSets.includes(DISCLOSURE_RULE_SET);

  return (
    <div className="mt-1.5 space-y-1 text-[11px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
        {hashtags.length > 0 && (
          <span className={`inline-flex items-center gap-1 ${over ? "font-semibold text-amber-700 dark:text-amber-300" : ""}`}>
            <Hash className="w-3 h-3" />
            {hashtags.length}
            {maxHashtags != null && ` of ${maxHashtags}`} hashtag{hashtags.length === 1 ? "" : "s"}
          </span>
        )}
        {cashtags.length > 0 && (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <TrendingUp className="w-3 h-3" /> {cashtags.join(" ")}
          </span>
        )}
        {mentions.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <AtSign className="w-3 h-3" /> {mentions.join(" ")}
          </span>
        )}
      </div>
      {over && (
        <p className="text-amber-700 dark:text-amber-300">
          {maxReason ?? `Up to ${maxHashtags}`}: remove {hashtags.length - (maxHashtags ?? 0)} hashtag
          {hashtags.length - (maxHashtags ?? 0) === 1 ? "" : "s"}. More reads as a hashtag wall.
        </p>
      )}
      {cashtags.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <span>{cashtags.join(" ")} puts this post in front of investors, so investor-disclosure rules apply to everything it says.</span>
          {needsDisclosure && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              onClick={() => onAddRuleSet(DISCLOSURE_RULE_SET)}
            >
              Add the {DISCLOSURE_RULE_SET} rules
            </Button>
          )}
        </p>
      )}
      {mentions.length > 0 && (
        <p className="text-muted-foreground">
          Tagging an account links it to this post. Tagging a government or military account needs the DoD
          no-endorsement wording; the check flags it otherwise.
        </p>
      )}
    </div>
  );
}
