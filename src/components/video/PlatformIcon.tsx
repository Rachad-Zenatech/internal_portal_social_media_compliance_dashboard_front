import { Globe } from "lucide-react";
import type { TargetPlatform } from "@/context/VideoUploadQueueContext";

export type SocialPlatform = TargetPlatform | "INSTAGRAM" | "FACEBOOK" | "X" | "REDDIT" | "WEBSITE";

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  YOUTUBE_SHORTS: "YouTube Shorts",
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  X: "X (Twitter)",
  REDDIT: "Reddit",
  WEBSITE: "Website / Blog",
};

/** Small brand mark for a platform (lucide ships no brand icons). */
export default function PlatformIcon({ platform, className = "w-4 h-4" }: { platform: SocialPlatform; className?: string }) {
  switch (platform) {
    case "TIKTOK":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            fill="currentColor"
            d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-2.59-2.59 2.59 2.59 0 0 1 3.4-2.46V9.69a5.68 5.68 0 0 0-6.49 5.62A5.68 5.68 0 0 0 9.86 21a5.68 5.68 0 0 0 5.68-5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48Z"
          />
        </svg>
      );
    case "LINKEDIN":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect width="24" height="24" rx="4" fill="#0A66C2" />
          <path
            fill="#fff"
            d="M7.1 9.6h2.5V18H7.1V9.6Zm1.25-4.02a1.45 1.45 0 1 1 0 2.9 1.45 1.45 0 0 1 0-2.9ZM11.2 9.6h2.4v1.15h.04c.33-.63 1.15-1.3 2.37-1.3 2.54 0 3 1.67 3 3.84V18h-2.5v-4.13c0-.98-.02-2.25-1.37-2.25-1.37 0-1.58 1.07-1.58 2.18V18h-2.36V9.6Z"
          />
        </svg>
      );
    case "YOUTUBE_SHORTS":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            fill="#FF0000"
            d="M17.4 10.3 15.9 9.5l1.6-.8a3.9 3.9 0 0 0-3.6-6.9L7.4 5.2a3.9 3.9 0 0 0-.2 6.9l1.5.8-1.6.8a3.9 3.9 0 0 0 3.6 6.9l6.5-3.4a3.9 3.9 0 0 0 .2-6.9Z"
          />
          <path fill="#fff" d="m10 14.6 4.6-2.6L10 9.4v5.2Z" />
        </svg>
      );
    case "YOUTUBE":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect x="1" y="4.5" width="22" height="15" rx="4" fill="#FF0000" />
          <path fill="#fff" d="m10 15.5 5.5-3.5L10 8.5v7Z" />
        </svg>
      );
    case "INSTAGRAM":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#FEDA75" />
              <stop offset="0.4" stopColor="#FA7E1E" />
              <stop offset="0.7" stopColor="#D62976" />
              <stop offset="1" stopColor="#4F5BD5" />
            </linearGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
          <rect x="6" y="6" width="12" height="12" rx="3.5" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.8" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="16.1" cy="7.9" r="0.9" fill="#fff" />
        </svg>
      );
    case "FACEBOOK":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="12" fill="#1877F2" />
          <path fill="#fff" d="M13.3 24v-8.4h2.8l.4-3.3h-3.2v-2.1c0-.9.3-1.6 1.6-1.6h1.7V5.7c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.1v3.3h2.8V24h3.4Z" />
        </svg>
      );
    case "X":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            fill="currentColor"
            d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.18h1.7L7.4 4.74H5.58l11.09 14.44Z"
          />
        </svg>
      );
    case "REDDIT":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="12" fill="#FF4500" />
          <ellipse cx="12" cy="14" rx="6" ry="4" fill="#fff" />
          <circle cx="9.7" cy="13.6" r="0.9" fill="#FF4500" />
          <circle cx="14.3" cy="13.6" r="0.9" fill="#FF4500" />
          <circle cx="16.8" cy="7" r="1.2" fill="#fff" />
          <path d="M12 10 13 6.2l3.6.8" fill="none" stroke="#fff" strokeWidth="0.9" />
        </svg>
      );
    default:
      return <Globe className={className} />;
  }
}
