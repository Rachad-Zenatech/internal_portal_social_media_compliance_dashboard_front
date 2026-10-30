import { AtSign, Hash, TrendingUp } from "lucide-react";

import { readSignals } from "@/lib/postSignals";

const DISCLOSURE_RULE_SET = "Public Company Disclosure";

/**
 * Live feedback under the caption: the hashtags, cashtags and mentions in it, whether there are more hashtags than
 * the platforms suit, and, when the caption carries the company cashtag, that investor-disclosure rules apply (the
 * check adds them automatically when they aren't selected).
 */
export default function CaptionSignalsBar({
  caption,
  maxHashtags,
  maxReason,
  ruleSets,
}: {
  caption: string;
  maxHashtags: number | null;
  maxReason?: string | null;
  ruleSets: string[];
}) {
  const { cashtags, hashtags, mentions } = readSignals(caption);
  if (!cashtags.length && !hashtags.length && !mentions.length) return null;

  const over = maxHashtags != null && hashtags.length > maxHashtags;
  const disclosureChosen = ruleSets.includes(DISCLOSURE_RULE_SET);

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
        <p className="text-muted-foreground">
          {cashtags.join(" ")} puts this post in front of investors, so investor-disclosure rules apply to everything it
          says{disclosureChosen ? "." : `: the check adds the ${DISCLOSURE_RULE_SET} rules automatically.`}
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
