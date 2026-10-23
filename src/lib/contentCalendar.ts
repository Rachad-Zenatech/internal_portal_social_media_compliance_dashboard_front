/**
 * Content Calendar mock layer: sample approved posts, what each platform's API can create, and a
 * browser-only record of simulated publishes. Replace with API calls once platform publishing exists.
 */
import { useSyncExternalStore } from "react";
import { addDays, addHours, setHours, setMinutes, startOfDay, startOfHour } from "date-fns";

import type { CalendarItem, PlatformPublishInfo, PublishMode, PublishRecord } from "@/types/calendar";
import type { AccountOption, SubmissionSummary } from "@/types/submission";

/**
 * What publishing creates on each platform. Not every API supports true drafts, so some posts become a private
 * upload, a scheduled post or a ready-to-post package instead. Confirm against each API when it's connected.
 */
export const PUBLISH_INFO: Record<string, PlatformPublishInfo> = {
  LINKEDIN: {
    mode: "DRAFT",
    action: "Create LinkedIn draft",
    result: "Draft saved on LinkedIn, ready for a final check and Post",
    note: "LinkedIn's Posts API can save a post as a draft. Shaun's personal profile needs his own sign-in consent.",
    captionLimit: 3000,
  },
  FACEBOOK: {
    mode: "DRAFT",
    action: "Create Facebook draft",
    result: "Unpublished post saved on the Facebook Page",
    note: "Facebook Pages can hold unpublished posts that a page admin publishes later.",
    captionLimit: 63206,
  },
  TIKTOK: {
    mode: "DRAFT",
    action: "Send to TikTok drafts",
    result: "Video in the account's TikTok drafts inbox, finished and posted in the app",
    note: "TikTok's Content Posting API uploads video to the creator's inbox as a draft; the final post happens in TikTok.",
    captionLimit: 2200,
  },
  YOUTUBE: {
    mode: "PRIVATE_UPLOAD",
    action: "Upload as private video",
    result: "Private video on the YouTube channel, switched to public when it's time",
    note: "YouTube has no drafts; a private upload plays the same role.",
    captionLimit: 5000,
  },
  YOUTUBE_SHORTS: {
    mode: "PRIVATE_UPLOAD",
    action: "Upload as private Short",
    result: "Private Short on the YouTube channel, switched to public when it's time",
    note: "YouTube has no drafts; a private upload plays the same role.",
    captionLimit: 5000,
  },
  INSTAGRAM: {
    mode: "SCHEDULED",
    action: "Schedule Instagram post",
    result: "Post scheduled for the planned time",
    note: "Instagram's API has no drafts, so the approved post is scheduled instead.",
    captionLimit: 2200,
  },
  X: {
    mode: "HANDOFF",
    action: "Prepare X post package",
    result: "Ready-to-post package: final text and media to post or schedule",
    note: "X's API has no drafts. The post is packaged for posting, or scheduled through a scheduling tool.",
    captionLimit: 280,
  },
  REDDIT: {
    mode: "HANDOFF",
    action: "Prepare Reddit post package",
    result: "Ready-to-post package for the subreddit",
    note: "Reddit has no drafts through its API, so the post is handed off for posting.",
    captionLimit: 40000,
  },
  WEBSITE: {
    mode: "HANDOFF",
    action: "Prepare website post package",
    result: "Ready-to-post package for the website team",
    note: "Website and blog posts are handed to the web team.",
    captionLimit: 100000,
  },
};

export const MODE_LABELS: Record<PublishMode, string> = {
  DRAFT: "Draft",
  PRIVATE_UPLOAD: "Private upload",
  SCHEDULED: "Scheduled post",
  HANDOFF: "Post package",
};

export function publishInfo(platform: string): PlatformPublishInfo {
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

const SHAUN_LINKEDIN = account("sample-shaun-li", "Shaun – CEO", "LINKEDIN", "shaun-ceo", { is_ceo: true });
const SHAUN_X = account("sample-shaun-x", "Shaun – CEO", "X", "shaun_zena", { is_ceo: true });
const ZENATECH_LINKEDIN = account("sample-zt-li", "ZenaTech", "LINKEDIN", "zenatech");
const ZENADRONE_X = account("sample-zd-x", "ZenaDrone", "X", "zenadrone");
const ZENATECH_TIKTOK = account("sample-zt-tt", "ZenaTech", "TIKTOK", "zenatech");
const ZENADRONE_YT = account("sample-zd-yt", "ZenaDrone", "YOUTUBE", "zenadrone");
const ZENATECH_IG = account("sample-zt-ig", "ZenaTech", "INSTAGRAM", "zenatech");
const DAAS_FB = account("sample-daas-fb", "DaaS (Drone as a Service)", "FACEBOOK", "dronesasaservice");

// `day`/`time` place a post relative to today; `inHours` places today's posts relative to now, so they're always
// still upcoming. One sample is deliberately left in the past to show what an overdue post looks like.
type Sample = Omit<CalendarItem, "id" | "source" | "publishAt" | "referenceCode"> &
  ({ day: number; time: [number, number]; inHours?: never } | { inHours: number; day?: never; time?: never });

const SAMPLES: Sample[] = [
  {
    day: -3, time: [9, 0], title: "Counter-UAS economics", contentType: "SOCIAL_POST", platforms: ["LINKEDIN"],
    account: SHAUN_LINKEDIN, brand: "ZenaDrone", score: 100, approvedBy: "Compliance Review", poster: "dusk",
    caption: "A cheap threat can impose an expensive response. Winning the engagement while losing the cost exchange isn't a sustainable model.\n\nWe believe lower-cost autonomous interception will be part of the answer. That challenge is informing ZenaDrone's counter-UAS development work.",
  },
  {
    day: 3, time: [11, 30], title: "Field test recap (development test)", contentType: "VIDEO", platforms: ["YOUTUBE", "TIKTOK"],
    account: ZENADRONE_YT, brand: "ZenaDrone", score: 95, approvedBy: "Compliance Review", poster: "desert",
    caption: "ZenaDrone 1000 during a development test focused on payload handling. Development-stage system; capabilities shown are part of ongoing testing.",
  },
  {
    inHours: 2, title: "Decision speed, not more sensors", contentType: "SOCIAL_POST", platforms: ["LINKEDIN", "X"],
    account: SHAUN_LINKEDIN, brand: "ZenaTech", score: 100, approvedBy: "Executive Review", poster: "night",
    caption: "The next ISR advantage may not come from collecting more. It may come from deciding faster.\n\nZenaDrone is developing autonomous capabilities intended to help turn sensor inputs into more timely mission awareness.",
  },
  {
    inHours: 5, title: "Quarterly webinar reminder", contentType: "SOCIAL_POST", platforms: ["LINKEDIN"],
    account: ZENATECH_LINKEDIN, brand: "ZenaTech", score: 100, approvedBy: "Investor Relations Review", poster: "desert",
    caption: "Join ZenaTech's quarterly update webinar this Thursday. Registration link in the comments.",
  },
  {
    day: 1, time: [12, 0], title: "Behind the build: assembly line", contentType: "VIDEO", platforms: ["TIKTOK", "INSTAGRAM"],
    account: ZENATECH_TIKTOK, brand: "ZenaTech", score: 90, approvedBy: "Marketing Review", poster: "dusk",
    caption: "A look inside the workshop where our development-stage drones come together. #ZenaTech #Engineering #Drones",
  },
  {
    day: 2, time: [9, 30], title: "Contested logistics", contentType: "SOCIAL_POST", platforms: ["X"],
    account: ZENADRONE_X, brand: "ZenaDrone", score: 100, approvedBy: "Compliance Review", poster: "night",
    caption: "The most consequential autonomous aircraft may be the one carrying blood, batteries or critical supplies. That's why we're developing unmanned logistics.",
  },
  {
    day: 4, time: [14, 0], title: "DaaS inspection services", contentType: "IMAGE", platforms: ["FACEBOOK"],
    account: DAAS_FB, brand: "Drone as a Service", score: 100, approvedBy: "Marketing Review", poster: "desert",
    caption: "Roof, solar and infrastructure inspections by drone, without scaffolding or downtime. Book a consultation with our DaaS team.",
  },
  {
    day: 6, time: [10, 0], title: "Swarm coordination", contentType: "SOCIAL_POST", platforms: ["LINKEDIN", "X"],
    account: SHAUN_X, brand: "ZenaDrone", score: 95, approvedBy: "Executive Review", poster: "night",
    caption: "Scale without coordination is congestion. The real advantage is resilient autonomy under pressure. Our work explores how autonomous systems could coordinate in degraded environments.",
  },
  {
    day: 8, time: [16, 0], title: "Trusted industrial base", contentType: "SOCIAL_POST", platforms: ["LINKEDIN"],
    account: SHAUN_LINKEDIN, brand: "ZenaDrone", score: 100, approvedBy: "Executive Review", poster: "dusk",
    caption: "Drone sovereignty isn't only where final assembly happens. It's whether the supply chain can be trusted, secured and scaled.",
  },
  {
    day: 11, time: [11, 0], title: "Conceptual mission visualization", contentType: "VIDEO", platforms: ["YOUTUBE_SHORTS", "INSTAGRAM"],
    account: ZENATECH_IG, brand: "ZenaDrone", score: 90, approvedBy: "Legal Review", poster: "night",
    caption: "Conceptual visualization - depicts a potential future use, not an actual military operation, deployment or endorsement.",
  },
  {
    day: 15, time: [9, 0], title: "Hiring: flight test engineers", contentType: "SOCIAL_POST", platforms: ["LINKEDIN"],
    account: ZENATECH_LINKEDIN, brand: "ZenaTech", score: 100, approvedBy: "Marketing Review", poster: "desert",
    caption: "We're growing our flight test team. If you like turning prototypes into evidence, we'd like to meet you.",
  },
  {
    day: 20, time: [13, 0], title: "Autonomy and human authority", contentType: "VIDEO", platforms: ["YOUTUBE", "LINKEDIN"],
    account: ZENADRONE_YT, brand: "ZenaDrone", score: 95, approvedBy: "Compliance Review", poster: "dusk",
    caption: "Autonomy works best with clear human authority and safeguards. A short explainer on how we think about the operator's role.",
  },
];

export function sampleItems(now = new Date()): CalendarItem[] {
  const base = startOfDay(now);
  return SAMPLES.map(({ day, time, inHours, ...rest }, i) => ({
    ...rest,
    id: `sample-${i + 1}`,
    source: "sample",
    referenceCode: `SAMPLE-${String(i + 1).padStart(2, "0")}`,
    publishAt: (inHours != null
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
    source: "submission",
    submissionId: s.id,
    referenceCode: s.reference_code,
    title: s.title,
    caption: s.caption_text ?? "",
    contentType: s.content_type,
    platforms: s.platforms,
    account: s.account ?? null,
    publishAt: s.publish_at,
    brand: s.brand_code ?? "",
    score: s.latest_score ?? null,
    media: s.cover ?? null,
  };
}

// ---------------------------------------------------------------------------
// Simulated publishes (this browser only)
// ---------------------------------------------------------------------------

const STORE_KEY = "contentCalendar.published";
const CHANGE_EVENT = "content-calendar-published";
const EMPTY: Record<string, PublishRecord> = {};
let cache: { raw: string | null; value: Record<string, PublishRecord> } = { raw: null, value: EMPTY };

function read(): Record<string, PublishRecord> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cache.raw) {
    try {
      cache = { raw, value: raw ? JSON.parse(raw) : EMPTY };
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

export function recordPublish(itemId: string, platform: string, mode: PublishMode): PublishRecord {
  const record: PublishRecord = {
    mode,
    at: new Date().toISOString(),
    ref: `${platform.slice(0, 2)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  };
  write({ ...read(), [publishKey(itemId, platform)]: record });
  return record;
}

export function clearPublished() {
  write({});
}
