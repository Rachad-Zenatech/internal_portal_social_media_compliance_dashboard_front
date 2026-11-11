/**
 * Content Calendar mock layer: sample approved posts, what each platform's API can create, and a
 * browser-only record of simulated publishes. Replace with API calls once platform publishing exists.
 */
import { useSyncExternalStore } from "react";
import { addDays, addHours, setHours, setMinutes, startOfDay, startOfHour } from "date-fns";

import type { CalendarItem, PlatformPublishInfo, PublishMode, PublishRecord, PublishStyle } from "@/types/calendar";
import type { AccountOption, SubmissionSummary } from "@/types/submission";

/**
 * What publishing creates on each platform. Not every API supports true drafts, so some posts become a private
 * upload, a scheduled post or a ready-to-post package instead. Confirm against each API when it's connected.
 */
/** The mode each on-screen style maps to: everything but a scheduled post is saved on the platform as a draft. */
export const MODE_OF_STYLE: Record<PublishStyle, PublishMode> = {
  DRAFT: "DRAFT_ON_PLATFORM",
  PRIVATE_UPLOAD: "DRAFT_ON_PLATFORM",
  HANDOFF: "DRAFT_ON_PLATFORM",
  SCHEDULED: "SCHEDULED",
};

/** Platforms that won't take a post without a video or image. */
const NEEDS_MEDIA = new Set(["TIKTOK", "YOUTUBE", "YOUTUBE_SHORTS", "INSTAGRAM"]);

/** A platform's publish info with its caption limit always set. */
export type PublishInfo = PlatformPublishInfo & { max_characters: number };

export const PUBLISH_INFO: Record<string, PublishInfo> = {
  LINKEDIN: {
    platform: "LINKEDIN",
    style: "DRAFT",
    allowed_modes: [MODE_OF_STYLE.DRAFT],
    requires_media: NEEDS_MEDIA.has("LINKEDIN"),
    action: "Create LinkedIn draft",
    result: "Draft saved on LinkedIn, ready for a final check and Post",
    note: "LinkedIn's Posts API can save a post as a draft. Shaun's personal profile needs his own sign-in consent.",
    max_characters: 3000,
  },
  FACEBOOK: {
    platform: "FACEBOOK",
    style: "DRAFT",
    allowed_modes: [MODE_OF_STYLE.DRAFT],
    requires_media: NEEDS_MEDIA.has("FACEBOOK"),
    action: "Create Facebook draft",
    result: "Unpublished post saved on the Facebook Page",
    note: "Facebook Pages can hold unpublished posts that a page admin publishes later.",
    max_characters: 63206,
  },
  TIKTOK: {
    platform: "TIKTOK",
    style: "DRAFT",
    allowed_modes: [MODE_OF_STYLE.DRAFT],
    requires_media: NEEDS_MEDIA.has("TIKTOK"),
    action: "Send to TikTok drafts",
    result: "Video in the account's TikTok drafts inbox, finished and posted in the app",
    note: "TikTok's Content Posting API uploads video to the creator's inbox as a draft; the final post happens in TikTok.",
    max_characters: 2200,
  },
  YOUTUBE: {
    platform: "YOUTUBE",
    style: "PRIVATE_UPLOAD",
    allowed_modes: [MODE_OF_STYLE.PRIVATE_UPLOAD],
    requires_media: NEEDS_MEDIA.has("YOUTUBE"),
    action: "Upload as private video",
    result: "Private video on the YouTube channel, switched to public when it's time",
    note: "YouTube has no drafts; a private upload plays the same role.",
    max_characters: 5000,
  },
  YOUTUBE_SHORTS: {
    platform: "YOUTUBE_SHORTS",
    style: "PRIVATE_UPLOAD",
    allowed_modes: [MODE_OF_STYLE.PRIVATE_UPLOAD],
    requires_media: NEEDS_MEDIA.has("YOUTUBE_SHORTS"),
    action: "Upload as private Short",
    result: "Private Short on the YouTube channel, switched to public when it's time",
    note: "YouTube has no drafts; a private upload plays the same role.",
    max_characters: 5000,
  },
  INSTAGRAM: {
    platform: "INSTAGRAM",
    style: "SCHEDULED",
    allowed_modes: [MODE_OF_STYLE.SCHEDULED],
    requires_media: NEEDS_MEDIA.has("INSTAGRAM"),
    action: "Schedule Instagram post",
    result: "Post scheduled for the planned time",
    note: "Instagram's API has no drafts, so the approved post is scheduled instead.",
    max_characters: 2200,
  },
  X: {
    platform: "X",
    style: "HANDOFF",
    allowed_modes: [MODE_OF_STYLE.HANDOFF],
    requires_media: NEEDS_MEDIA.has("X"),
    action: "Prepare X post package",
    result: "Ready-to-post package: final text and media to post or schedule",
    note: "X's API has no drafts. The post is packaged for posting, or scheduled through a scheduling tool.",
    max_characters: 280,
  },
  REDDIT: {
    platform: "REDDIT",
    style: "HANDOFF",
    allowed_modes: [MODE_OF_STYLE.HANDOFF],
    requires_media: NEEDS_MEDIA.has("REDDIT"),
    action: "Prepare Reddit post package",
    result: "Ready-to-post package for the subreddit",
    note: "Reddit has no drafts through its API, so the post is handed off for posting.",
    max_characters: 40000,
  },
  WEBSITE: {
    platform: "WEBSITE",
    style: "HANDOFF",
    allowed_modes: [MODE_OF_STYLE.HANDOFF],
    requires_media: NEEDS_MEDIA.has("WEBSITE"),
    action: "Prepare website post package",
    result: "Ready-to-post package for the website team",
    note: "Website and blog posts are handed to the web team.",
    max_characters: 100000,
  },
};

export const MODE_LABELS: Record<PublishStyle, string> = {
  DRAFT: "Draft",
  PRIVATE_UPLOAD: "Private upload",
  SCHEDULED: "Scheduled post",
  HANDOFF: "Post package",
};

export function publishInfo(platform: string): PublishInfo {
  return PUBLISH_INFO[platform] ?? PUBLISH_INFO.WEBSITE;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

function account(id: string, name: string, platform: string, handle: string, extra: Partial<AccountOption> = {}): AccountOption {
  return {
    id,
    label: `${name} (${platform})`,
    account_name: name,
    provider: platform,
    platform,
    handle,
    is_ceo: false,
    is_demo: true,
    ...extra,
  };
}

const SHAUN_LINKEDIN = account("sample-shaun-li", "Shaun – CEO", "LINKEDIN", "shaun-ceo", { is_ceo: true, brand_code: "CEO_THOUGHT_LEADERSHIP" });
const SHAUN_X = account("sample-shaun-x", "Shaun – CEO", "X", "shaun_zena", { is_ceo: true, brand_code: "CEO_THOUGHT_LEADERSHIP" });
const ZENATECH_LINKEDIN = account("sample-zt-li", "ZenaTech", "LINKEDIN", "zenatech", { brand_code: "ZENATECH" });
const ZENADRONE_X = account("sample-zd-x", "ZenaDrone", "X", "zenadrone", { brand_code: "ZENADRONE" });
const ZENATECH_TIKTOK = account("sample-zt-tt", "ZenaTech", "TIKTOK", "zenatech", { brand_code: "ZENATECH" });
const ZENADRONE_YT = account("sample-zd-yt", "ZenaDrone", "YOUTUBE", "zenadrone", { brand_code: "ZENADRONE" });
const ZENATECH_IG = account("sample-zt-ig", "ZenaTech", "INSTAGRAM", "zenatech", { brand_code: "ZENATECH" });
const DAAS_FB = account("sample-daas-fb", "DaaS (Drone as a Service)", "FACEBOOK", "dronesasaservice");

// `day`/`time` place a post relative to today; `inHours` places today's posts relative to now, so they're always
// still upcoming. One sample is deliberately left in the past to show what an overdue post looks like.
type Sample = Omit<CalendarItem, "id" | "is_sample" | "scheduled_for" | "reference_code" | "primary_platform" | "publish_mode"> &
  ({ day: number; time: [number, number]; inHours?: never } | { inHours: number; day?: never; time?: never });

const SAMPLES: Sample[] = [
  {
    day: -3, time: [9, 0], title: "Counter-UAS economics", content_type: "SOCIAL_POST", platforms: ["LINKEDIN"],
    account: SHAUN_LINKEDIN, brand_code: "CEO_THOUGHT_LEADERSHIP", score: 100, approved_by: "Compliance Review", poster_variant: "dusk",
    caption: "A cheap threat can impose an expensive response. Winning the engagement while losing the cost exchange isn't a sustainable model.\n\nWe believe lower-cost autonomous interception will be part of the answer. That challenge is informing ZenaDrone's counter-UAS development work.",
  },
  {
    day: 3, time: [11, 30], title: "Field test recap (development test)", content_type: "VIDEO", platforms: ["YOUTUBE", "TIKTOK"],
    account: ZENADRONE_YT, brand_code: "ZENADRONE", score: 95, approved_by: "Compliance Review", poster_variant: "desert",
    caption: "ZenaDrone 1000 during a development test focused on payload handling. Development-stage system; capabilities shown are part of ongoing testing.",
  },
  {
    inHours: 2, title: "Decision speed, not more sensors", content_type: "SOCIAL_POST", platforms: ["LINKEDIN", "X"],
    account: SHAUN_LINKEDIN, brand_code: "CEO_THOUGHT_LEADERSHIP", score: 100, approved_by: "Executive Review", poster_variant: "night",
    caption: "The next ISR advantage may not come from collecting more. It may come from deciding faster.\n\nZenaDrone is developing autonomous capabilities intended to help turn sensor inputs into more timely mission awareness.",
  },
  {
    inHours: 5, title: "Quarterly webinar reminder", content_type: "SOCIAL_POST", platforms: ["LINKEDIN"],
    account: ZENATECH_LINKEDIN, brand_code: "ZENATECH", score: 100, approved_by: "Investor Relations Review", poster_variant: "desert",
    caption: "Join ZenaTech's quarterly update webinar this Thursday. Registration link in the comments.",
  },
  {
    day: 1, time: [12, 0], title: "Behind the build: assembly line", content_type: "VIDEO", platforms: ["TIKTOK", "INSTAGRAM"],
    account: ZENATECH_TIKTOK, brand_code: "ZENATECH", score: 90, approved_by: "Marketing Review", poster_variant: "dusk",
    caption: "A look inside the workshop where our development-stage drones come together. #ZenaTech #Engineering #Drones",
  },
  {
    day: 2, time: [9, 30], title: "Contested logistics", content_type: "SOCIAL_POST", platforms: ["X"],
    account: ZENADRONE_X, brand_code: "ZENADRONE", score: 100, approved_by: "Compliance Review", poster_variant: "night",
    caption: "The most consequential autonomous aircraft may be the one carrying blood, batteries or critical supplies. That's why we're developing unmanned logistics.",
  },
  {
    day: 4, time: [14, 0], title: "DaaS inspection services", content_type: "IMAGE", platforms: ["FACEBOOK"],
    account: DAAS_FB, brand_code: "DAAS", score: 100, approved_by: "Marketing Review", poster_variant: "desert",
    caption: "Roof, solar and infrastructure inspections by drone, without scaffolding or downtime. Book a consultation with our DaaS team.",
  },
  {
    day: 6, time: [10, 0], title: "Swarm coordination", content_type: "SOCIAL_POST", platforms: ["LINKEDIN", "X"],
    account: SHAUN_X, brand_code: "CEO_THOUGHT_LEADERSHIP", score: 95, approved_by: "Executive Review", poster_variant: "night",
    caption: "Scale without coordination is congestion. The real advantage is resilient autonomy under pressure. Our work explores how autonomous systems could coordinate in degraded environments.",
  },
  {
    day: 8, time: [16, 0], title: "Trusted industrial base", content_type: "SOCIAL_POST", platforms: ["LINKEDIN"],
    account: SHAUN_LINKEDIN, brand_code: "CEO_THOUGHT_LEADERSHIP", score: 100, approved_by: "Executive Review", poster_variant: "dusk",
    caption: "Drone sovereignty isn't only where final assembly happens. It's whether the supply chain can be trusted, secured and scaled.",
  },
  {
    day: 11, time: [11, 0], title: "Conceptual mission visualization", content_type: "VIDEO", platforms: ["YOUTUBE_SHORTS", "INSTAGRAM"],
    account: ZENATECH_IG, brand_code: "ZENATECH", score: 90, approved_by: "Legal Review", poster_variant: "night",
    caption: "Conceptual visualization - depicts a potential future use, not an actual military operation, deployment or endorsement.",
  },
  {
    day: 15, time: [9, 0], title: "Hiring: flight test engineers", content_type: "SOCIAL_POST", platforms: ["LINKEDIN"],
    account: ZENATECH_LINKEDIN, brand_code: "ZENATECH", score: 100, approved_by: "Marketing Review", poster_variant: "desert",
    caption: "We're growing our flight test team. If you like turning prototypes into evidence, we'd like to meet you.",
  },
  {
    day: 20, time: [13, 0], title: "Autonomy and human authority", content_type: "VIDEO", platforms: ["YOUTUBE", "LINKEDIN"],
    account: ZENADRONE_YT, brand_code: "ZENADRONE", score: 95, approved_by: "Compliance Review", poster_variant: "dusk",
    caption: "Autonomy works best with clear human authority and safeguards. A short explainer on how we think about the operator's role.",
  },
];

export function sampleItems(now = new Date()): CalendarItem[] {
  const base = startOfDay(now);
  return SAMPLES.map(({ day, time, inHours, ...rest }, i) => ({
    ...rest,
    id: `sample-${i + 1}`,
    is_sample: true,
    reference_code: `SAMPLE-${String(i + 1).padStart(2, "0")}`,
    primary_platform: rest.platforms[0],
    publish_mode: MODE_OF_STYLE[publishInfo(rest.platforms[0]).style],
    scheduled_for: (inHours != null
      ? addHours(startOfHour(now), inHours)
      : setMinutes(setHours(addDays(base, day!), time![0]), time![1])
    ).toISOString(),
  }));
}

/** A real approved submission with a publish date, as a calendar item. */
export function fromSubmission(s: SubmissionSummary): CalendarItem | null {
  if (s.status !== "APPROVED" || !s.publish_at) return null;
  return {
    id: `sub-${s.id}`,
    submission_id: s.id,
    reference_code: s.reference_code,
    title: s.title,
    caption: s.caption_text ?? "",
    // Each account's own caption, by the platform it publishes to (YouTube accounts post Shorts too).
    captions_by_platform: Object.fromEntries(
      (s.accounts ?? []).flatMap((a) => {
        const text = s.account_captions?.[a.id];
        if (!text) return [];
        return (a.platform === "YOUTUBE" ? ["YOUTUBE", "YOUTUBE_SHORTS"] : [a.platform]).map((p) => [p, text] as const);
      })
    ),
    content_type: s.content_type,
    platforms: s.platforms,
    primary_platform: s.platforms[0] ?? "",
    publish_mode: MODE_OF_STYLE[publishInfo(s.platforms[0] ?? "").style],
    account_id: s.account?.id ?? null,
    account: s.account ?? null,
    scheduled_for: s.publish_at,
    brand_code: s.brand_code ?? "",
    score: s.latest_score ?? null,
    primary_file: s.cover ?? null,
  };
}

// ---------------------------------------------------------------------------
// Simulated publishes (this browser only)
// ---------------------------------------------------------------------------

const STORE_KEY = "contentCalendar.published";
const CHANGE_EVENT = "content-calendar-published";
const EMPTY: Record<string, PublishRecord> = {};
let cache: { raw: string | null; value: Record<string, PublishRecord> } = { raw: null, value: EMPTY };

/** Records saved by an older version of this page (mode, at, ref) are read as the current shape. */
type LegacyRecord = { mode: PublishStyle; at: string; ref: string };

function upgrade(stored: Record<string, PublishRecord | LegacyRecord>): Record<string, PublishRecord> {
  return Object.fromEntries(
    Object.entries(stored).map(([key, r]) => {
      if ("created_at" in r) return [key, r];
      const split = key.lastIndexOf(":");
      return [
        key,
        {
          id: r.ref,
          submission_id: split > 0 ? key.slice(0, split) : key,
          platform: split > 0 ? key.slice(split + 1) : "",
          mode: MODE_OF_STYLE[r.mode] ?? "DRAFT_ON_PLATFORM",
          style: r.mode,
          status: r.mode === "SCHEDULED" ? "SCHEDULED" : "PENDING",
          remote_post_id: r.ref,
          created_at: r.at,
        } satisfies PublishRecord,
      ];
    })
  );
}

function read(): Record<string, PublishRecord> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cache.raw) {
    try {
      cache = { raw, value: raw ? upgrade(JSON.parse(raw)) : EMPTY };
    } catch {
      cache = { raw, value: EMPTY };
    }
  }
  return cache.value;
}

function write(next: Record<string, PublishRecord>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // simulated state just won't persist
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export const publishKey = (itemId: string, platform: string) => `${itemId}:${platform}`;

/** Simulated publish results, shared by the calendar and the publish page. */
export function usePublished() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function recordPublish(itemId: string, platform: string, style: PublishStyle): PublishRecord {
  const ref = `${platform.slice(0, 2)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const record: PublishRecord = {
    id: ref,
    submission_id: itemId,
    platform,
    mode: MODE_OF_STYLE[style],
    style,
    status: style === "SCHEDULED" ? "SCHEDULED" : "PENDING",
    remote_post_id: ref,
    created_at: new Date().toISOString(),
  };
  write({ ...read(), [publishKey(itemId, platform)]: record });
  return record;
}

export function clearPublished() {
  write({});
}

// ---------------------------------------------------------------------------
// Sent to Sprout Social (simulated in this browser until the Sprout API is connected)
// ---------------------------------------------------------------------------

/** One approved post handed to Sprout Social, which then schedules and publishes it on each profile. */
export interface SproutRecord {
  at: string;
  /** Mock Sprout post reference. */
  ref: string;
}

const SPROUT_KEY = "contentCalendar.sprout";
const SPROUT_EVENT = "content-calendar-sprout";
const NONE: Record<string, SproutRecord> = {};
let sproutCache: { raw: string | null; value: Record<string, SproutRecord> } = { raw: null, value: NONE };

function readSprout(): Record<string, SproutRecord> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SPROUT_KEY);
  } catch {
    return NONE;
  }
  if (raw !== sproutCache.raw) {
    try {
      sproutCache = { raw, value: raw ? JSON.parse(raw) : NONE };
    } catch {
      sproutCache = { raw, value: NONE };
    }
  }
  return sproutCache.value;
}

function writeSprout(next: Record<string, SproutRecord>) {
  try {
    localStorage.setItem(SPROUT_KEY, JSON.stringify(next));
  } catch {
    // simulated state just won't persist
  }
  window.dispatchEvent(new Event(SPROUT_EVENT));
}

function subscribeSprout(cb: () => void) {
  window.addEventListener(SPROUT_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SPROUT_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Posts sent to Sprout Social (simulated), by calendar item id. */
export function useSentToSprout() {
  return useSyncExternalStore(subscribeSprout, readSprout, () => NONE);
}

export function recordSproutSend(itemId: string): SproutRecord {
  const record: SproutRecord = { at: new Date().toISOString(), ref: `SPR-${Math.random().toString(36).slice(2, 8).toUpperCase()}` };
  writeSprout({ ...readSprout(), [itemId]: record });
  return record;
}

export function clearSproutSends() {
  writeSprout({});
}
