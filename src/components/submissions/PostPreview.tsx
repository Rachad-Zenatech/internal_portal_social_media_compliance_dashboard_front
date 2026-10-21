import { useState } from "react";
import {
  Bookmark,
  FileText,
  Film,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  Repeat2,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react";

import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import { useVideoThumbnail } from "@/lib/videoThumbnail";
import type { AccountOption, ContentType, SubmissionFile } from "@/types/submission";

const VERTICAL: string[] = ["TIKTOK", "YOUTUBE_SHORTS"];

function formatDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter((w) => /^[\p{L}\p{N}]/u.test(w))
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function ChannelAvatar({ account, size = "md" }: { account?: AccountOption | null; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "w-6 h-6 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <span
      className={`${dims} shrink-0 rounded-full grid place-items-center font-bold ${
        account?.is_ceo ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40" : "bg-primary/10 text-primary"
      }`}
    >
      {account ? initials(account.account_name) : "?"}
    </span>
  );
}

const CONTENT_ICONS: Record<string, typeof FileText> = {
  VIDEO: Film,
  IMAGE: ImageIcon,
  CAROUSEL: ImageIcon,
  SOCIAL_POST: MessageCircle,
  BLOG: FileText,
};

/** Card/list thumbnail: the picked video frame, the image itself, or a styled placeholder. */
export function CoverThumb({
  cover,
  contentType,
  caption,
  className = "",
  showPlay = true,
}: {
  cover?: SubmissionFile | null;
  contentType: ContentType | string;
  caption?: string | null;
  className?: string;
  showPlay?: boolean;
}) {
  const isVideo = Boolean(cover?.mime_type.startsWith("video/"));
  const src = cover ? authedFileUrl(cover.url) : null;
  const thumb = useVideoThumbnail(isVideo ? src : null);
  const Icon = CONTENT_ICONS[contentType] ?? FileText;

  if (cover && !isVideo && src) {
    return <img src={src} alt="" loading="lazy" className={`w-full h-full object-cover ${className}`} />;
  }
  if (isVideo) {
    return (
      <div className={`relative w-full h-full bg-neutral-900 ${className}`}>
        {thumb.dataUrl ? (
          <img src={thumb.dataUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Film className="w-6 h-6 text-white/40 animate-pulse" />
          </div>
        )}
        {showPlay && (
          <span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="w-10 h-10 rounded-full bg-black/55 backdrop-blur grid place-items-center">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </span>
          </span>
        )}
        {thumb.duration != null && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
            {formatDuration(thumb.duration)}
          </span>
        )}
      </div>
    );
  }
  // No media: show the caption itself, like a text post.
  return (
    <div className={`w-full h-full bg-gradient-to-br from-primary/10 via-muted to-muted p-3 flex flex-col ${className}`}>
      <Icon className="w-4 h-4 text-primary/70 shrink-0" />
      <p className="mt-2 text-[11px] leading-snug text-foreground/80 line-clamp-4">{caption?.trim() || "No media or caption yet"}</p>
    </div>
  );
}

function Media({ file, vertical }: { file?: SubmissionFile | null; vertical: boolean }) {
  if (!file) return null;
  const src = authedFileUrl(file.url);
  if (file.mime_type.startsWith("video/")) {
    return <VideoMedia src={src} vertical={vertical} />;
  }
  return <img src={src} alt="" className={`w-full ${vertical ? "h-full object-cover" : "max-h-[420px] object-cover"}`} />;
}

function VideoMedia({ src, vertical }: { src: string; vertical: boolean }) {
  const thumb = useVideoThumbnail(src);
  const [playing, setPlaying] = useState(false);
  if (!vertical) {
    return <video src={src} poster={thumb.dataUrl ?? undefined} controls playsInline preload="metadata" className="w-full max-h-[420px] bg-black" />;
  }
  // Short-form apps play on tap; native controls would cover the caption overlay.
  return (
    <>
      <video
        src={src}
        poster={thumb.dataUrl ?? undefined}
        playsInline
        loop
        preload="metadata"
        onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="w-full h-full object-cover bg-black cursor-pointer"
      />
      {!playing && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="w-12 h-12 rounded-full bg-black/45 grid place-items-center">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </span>
        </span>
      )}
    </>
  );
}

function Caption({ text, clamp = 4, className = "" }: { text: string; clamp?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220 || text.split("\n").length > clamp;
  return (
    <div className={className}>
      <p className={`whitespace-pre-wrap break-words ${!open && long ? "line-clamp-4" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[11px] font-semibold opacity-70 hover:opacity-100">
          {open ? "Show less" : "...more"}
        </button>
      )}
    </div>
  );
}

/**
 * Approximate look of the post on a platform: who it posts as, the caption and the media.
 * It's for checking the content reads right, not a pixel-accurate replica.
 */
export default function PostPreview({
  platform,
  account,
  title,
  caption,
  media,
  whenLabel,
}: {
  platform: SocialPlatform | string;
  account?: AccountOption | null;
  title: string;
  caption?: string | null;
  media?: SubmissionFile | null;
  whenLabel: string;
}) {
  const name = account?.account_name || "No channel selected";
  const handle = account?.handle ? `@${account.handle.replace(/^@/, "")}` : null;
  const text = caption?.trim() || "";
  const platformLabel = PLATFORM_LABELS[platform as SocialPlatform] ?? platform;

  if (VERTICAL.includes(platform)) {
    return (
      <div className="mx-auto w-[260px] aspect-[9/16] rounded-[22px] overflow-hidden bg-black relative shadow-lg ring-1 ring-black/10">
        {media ? <Media file={media} vertical /> : <div className="w-full h-full bg-gradient-to-b from-neutral-800 to-black" />}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pr-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white space-y-1">
          <p className="text-[12px] font-bold">{handle ?? name}</p>
          {text ? <p className="text-[11px] leading-snug line-clamp-3">{text}</p> : <p className="text-[11px] italic opacity-60">No caption yet</p>}
          <p className="flex items-center gap-1 text-[10px] opacity-80">
            <Music2 className="w-3 h-3" /> Original sound · {name}
          </p>
        </div>
        <div className="pointer-events-none absolute right-2 bottom-16 flex flex-col items-center gap-3 text-white">
          <ChannelAvatar account={account} size="sm" />
          <Heart className="w-5 h-5" />
          <MessageCircle className="w-5 h-5" />
          <Bookmark className="w-5 h-5" />
          <Share2 className="w-5 h-5" />
        </div>
        <span className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">
          <PlatformIcon platform={platform as SocialPlatform} className="w-3 h-3" /> {platformLabel}
        </span>
      </div>
    );
  }

  if (platform === "YOUTUBE") {
    return (
      <div className="rounded-xl overflow-hidden border border-border bg-card">
        <div className="aspect-video bg-black grid place-items-center">
          {media ? <Media file={media} vertical={false} /> : <Play className="w-8 h-8 text-white/40" />}
        </div>
        <div className="p-3 flex gap-2.5">
          <ChannelAvatar account={account} />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold leading-snug line-clamp-2">{title}</p>
            <p className="text-[11px] text-muted-foreground">
              {name} · {whenLabel}
            </p>
            {text && <Caption text={text} className="pt-1 text-[11px] text-muted-foreground" />}
          </div>
        </div>
      </div>
    );
  }

  // Feed-style post: LinkedIn, X, Instagram, Facebook, Reddit, website.
  const actions =
    platform === "LINKEDIN"
      ? [ThumbsUp, MessageCircle, Repeat2, Send]
      : platform === "X"
      ? [MessageCircle, Repeat2, Heart, Share2]
      : [Heart, MessageCircle, Send, Bookmark];
  const mediaFirst = platform === "INSTAGRAM";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 p-3">
        <ChannelAvatar account={account} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {handle ? `${handle} · ` : ""}
            {whenLabel}
          </p>
        </div>
        <PlatformIcon platform={platform as SocialPlatform} className="w-4 h-4" />
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </div>
      {!mediaFirst && (
        <div className="px-3 pb-3 text-[13px] leading-relaxed">
          {text ? <Caption text={text} /> : <p className="italic text-muted-foreground">No caption yet</p>}
        </div>
      )}
      {media && (
        <div className="bg-black">
          <Media file={media} vertical={false} />
        </div>
      )}
      {mediaFirst && (
        <div className="px-3 pt-3 text-[13px] leading-relaxed">
          {text ? (
            <Caption text={`${handle ?? name}  ${text}`} />
          ) : (
            <p className="italic text-muted-foreground">No caption yet</p>
          )}
        </div>
      )}
      <div className="flex items-center justify-around border-t border-border/70 mt-3 py-2 text-muted-foreground">
        {actions.map((A, i) => (
          <A key={i} className="w-4 h-4" />
        ))}
      </div>
    </div>
  );
}
