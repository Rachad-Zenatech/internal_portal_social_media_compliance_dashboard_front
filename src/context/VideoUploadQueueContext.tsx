import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useQueries, useQuery } from '@tanstack/react-query';
import { complianceService, type ComplianceViolation } from '@/services/complianceService';
import { submissionService } from '@/services/submissionService';
import { authedFileUrl, isAnalysing } from '@/components/submissions/submissionUi';
import { useAuth } from '@/lib/AuthContext';
import type {
  QueueTab,
  ReviewQueueCounts,
  ReviewQueueItem,
  StoredCheck,
  SubmissionStatus,
  TranscriptStatus,
  VersionView,
} from '@/types/submission';

const QUEUE_TABS: QueueTab[] = ['review', 'sent_back', 'done'];
const tabOf = (status: SubmissionStatus): QueueTab =>
  status === 'IN_REVIEW' ? 'review' : status === 'CHANGES_REQUESTED' ? 'sent_back' : 'done';

export type TargetPlatform =
  | 'TIKTOK'
  | 'YOUTUBE'
  | 'YOUTUBE_SHORTS'
  | 'LINKEDIN'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'X'
  | 'REDDIT'
  | 'WEBSITE';
export type PosterVariant = 'dusk' | 'desert' | 'night';
// 'analysing': checked, but the video or images are still being read, so there's no score yet.
export type ScoreStatus = 'pending' | 'analysing' | 'checked' | 'error';
export type VideoQueueStatus = 'QUEUED' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PAUSED';

export interface TimestampedSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  /** Text shown in the video rather than spoken. */
  onScreen?: boolean;
  violations?: ComplianceViolation[];
  risk?: 'RED' | 'YELLOW' | 'GREEN';
}

export interface VideoQueueItem {
  id: string;
  filename: string;
  title: string;
  platform: TargetPlatform;
  aspectRatio: '9:16' | '16:9';
  totalSizeBytes: number;
  uploadedBytes: number;
  uploadSpeedBps: number;
  progressPercent: number;
  status: VideoQueueStatus;
  currentStageIndex: number;
  currentStageLabel: string;
  estimatedSecondsRemaining: number;
  createdAt: string;
  completedAt?: string | null;
  videoUrl?: string | null;
  file?: File | null;
  segments: TimestampedSegment[];
  logs: string[];
  /** Filled in by the live rulebook check; meaningless until scoreStatus is 'checked'. */
  violationCount: number;
  complianceScore: number;
  scoreStatus: ScoreStatus;
  /** Illustrated placeholder for demo items that have no video file. */
  posterVariant?: PosterVariant;
  /** Built-in sample video rather than real submitted content. */
  isDemo?: boolean;
  /** Set for videos that come from a saved content submission. */
  submissionId?: string;
  referenceCode?: string;
  caption?: string | null;
  creatorName?: string | null;
  /** Submitted videos: the stored file and the state of its auto-generated transcript. */
  videoFileId?: string;
  transcriptStatus?: TranscriptStatus | null;
  transcriptError?: string | null;
  /** Submitted items: the server's rulebook check, the one score shown everywhere. */
  serverCheck?: StoredCheck | null;
  submissionStatus?: SubmissionStatus;
  currentVersion?: number;
  platforms?: string[];
  publishAt?: string | null;
  /** Deadline for the next step (reviewer or creator). */
  dueAt?: string | null;
  dueKind?: 'REVIEW' | 'REVISION' | null;
  /** The viewer is a reviewer who may decide on it. */
  canReview?: boolean;
  /** Which Screener tab it belongs to; demo items count as "review". */
  queueTab?: QueueTab;
  canApprove?: boolean;
  approverNames?: string[];
  openCriticalFlags?: number;
  /** Rulebook score counting only flags nobody has dismissed (null: none yet), and the least approval needs. */
  approvalScore?: number | null;
  minApprovalScore?: number;
  createdBy?: string | null;
  canManageApproval?: boolean;
  decidedAt?: string | null;
  /** Submitted posts: VIDEO, IMAGE, CAROUSEL, SOCIAL_POST, AD or BLOG. */
  contentType?: string | null;
  /** A submitted post's images in order (authed URLs); posts without a video are previewed with these. */
  images?: { id: string; url: string; name: string }[];
}

interface VideoUploadQueueContextType {
  queue: VideoQueueItem[];
  activeVideoId: string | null;
  activeVideo: VideoQueueItem | null;
  isQueueDrawerOpen: boolean;
  setIsQueueDrawerOpen: (open: boolean) => void;
  openQueueDrawer: () => void;
  closeQueueDrawer: () => void;
  setActiveVideoId: (id: string) => void;
  addToQueue: (params: {
    file?: File;
    filename?: string;
    title?: string;
    platform?: TargetPlatform;
    aspectRatio?: '9:16' | '16:9';
    sizeBytes?: number;
  }) => VideoQueueItem;
  removeFromQueue: (id: string) => void;
  retryItem: (id: string) => void;
  clearCompleted: () => void;
  activeUploadCount: number;
  totalQueueCount: number;
  simulateAdvanceActive: () => void;
  recordScanResult: (id: string, result: { score: number; violationCount: number; segments: TimestampedSegment[] }) => void;
  /** Whether the built-in sample videos are listed alongside real submissions. */
  showDemo: boolean;
  setShowDemo: (show: boolean) => void;
  serverQueueLoading: boolean;
  /** How many submitted videos are in each tab (from the server, not limited by what's loaded). */
  queueCounts: ReviewQueueCounts | null;
  /** Search for the Done tab (title or reference). */
  doneSearch: string;
  setDoneSearch: (search: string) => void;
}

const VideoUploadQueueContext = createContext<VideoUploadQueueContextType | undefined>(undefined);

const DEMO_SEGMENTS_1: TimestampedSegment[] = [
  {
    id: "s1-1",
    startSec: 0,
    endSec: 8,
    text: "Welcome to ZenaDrone. Today we showcase our next-generation autonomous flight telemetry in real-time field trials.",
    risk: "GREEN",
  },
  {
    id: "s1-2",
    startSec: 9,
    endSec: 19,
    text: "ZenaDrone has partnered with the U.S. Army to deliver combat-proven autonomous swarm logistics across front-line operations.",
    risk: "RED",
  },
  {
    id: "s1-3",
    startSec: 20,
    endSec: 32,
    text: "Pentagon procurement is failing our warfighters, but our fielded drone system is already adopted by active military commanders.",
    risk: "RED",
  },
  {
    id: "s1-4",
    startSec: 33,
    endSec: 46,
    text: "With sub-second dual sensor payloads, the ZenaDrone 1000 provides unjammable target locking under extreme ECM warfare environments.",
    risk: "YELLOW",
  },
  {
    id: "s1-5",
    startSec: 47,
    endSec: 60,
    text: "For more details on commercial autonomous logistics and civil infrastructure defense applications, visit zenatech.com.",
    risk: "GREEN",
  },
];

const DEMO_SEGMENTS_2: TimestampedSegment[] = [
  {
    id: "s2-1",
    startSec: 0,
    endSec: 15,
    text: "Autonomous border surveillance patrol unit operational footage. VTOL long-range endurance trial.",
    risk: "GREEN",
  },
  {
    id: "s2-2",
    startSec: 16,
    endSec: 30,
    text: "We expect a major defense contract this quarter, and the VTOL platform is ready for deployment along the southern border.",
    risk: "YELLOW",
  },
];

const INITIAL_QUEUE: VideoQueueItem[] = [
  {
    id: "job-uploading-001",
    filename: "zenadrone_swarm_field_trials_q4.mp4",
    title: "ZenaDrone 1000 Autonomous Swarm Field Trials (TikTok Cut)",
    platform: "TIKTOK",
    aspectRatio: "9:16",
    totalSizeBytes: 64 * 1024 * 1024, // 64 MB
    uploadedBytes: Math.round(64 * 1024 * 1024 * 0.45), // 45%
    uploadSpeedBps: 4.8 * 1024 * 1024, // 4.8 MB/s
    progressPercent: 45,
    status: "UPLOADING",
    currentStageIndex: 2,
    currentStageLabel: "Gemini Speech-to-Text Transcription",
    estimatedSecondsRemaining: 8,
    createdAt: new Date(Date.now() - 45000).toISOString(),
    segments: DEMO_SEGMENTS_1,
    logs: [
      `[${new Date(Date.now() - 40000).toLocaleTimeString()}] Chunk 01 uploaded (16.0 MB). Codec H.264 verified.`,
      `[${new Date(Date.now() - 25000).toLocaleTimeString()}] Chunk 02 uploaded (28.8 MB). Audio stream demuxed.`,
      `[${new Date(Date.now() - 10000).toLocaleTimeString()}] Gemini speech transcription running on buffered audio track...`,
    ],
    violationCount: 0,
    complianceScore: 0,
    scoreStatus: "pending",
    posterVariant: "dusk",
    isDemo: true,
  },
  {
    id: "job-queued-002",
    filename: "vtol_border_reconnaissance_deployment.mp4",
    title: "VTOL Border Patrol Reconnaissance Deployment (YouTube Cut)",
    platform: "YOUTUBE",
    aspectRatio: "16:9",
    totalSizeBytes: 112 * 1024 * 1024, // 112 MB
    uploadedBytes: 0,
    uploadSpeedBps: 0,
    progressPercent: 0,
    status: "QUEUED",
    currentStageIndex: 0,
    currentStageLabel: "Waiting in upload queue (#2)",
    estimatedSecondsRemaining: 35,
    createdAt: new Date(Date.now() - 20000).toISOString(),
    segments: DEMO_SEGMENTS_2,
    logs: [
      `[${new Date(Date.now() - 20000).toLocaleTimeString()}] Added to upload queue. Waiting for slot.`,
    ],
    violationCount: 0,
    complianceScore: 0,
    scoreStatus: "pending",
    posterVariant: "desert",
    isDemo: true,
  },
  {
    id: "job-completed-003",
    filename: "counter_uas_electronic_jamming_tactical.mp4",
    title: "Counter-UAS Electronic Warfare Tactical Demonstration",
    platform: "TIKTOK",
    aspectRatio: "9:16",
    totalSizeBytes: 42 * 1024 * 1024,
    uploadedBytes: 42 * 1024 * 1024,
    uploadSpeedBps: 0,
    progressPercent: 100,
    status: "COMPLETED",
    currentStageIndex: 4,
    currentStageLabel: "Compliance Screening & Clearance Complete",
    estimatedSecondsRemaining: 0,
    createdAt: new Date(Date.now() - 180000).toISOString(),
    completedAt: new Date(Date.now() - 120000).toISOString(),
    segments: DEMO_SEGMENTS_1,
    logs: [
      `[${new Date(Date.now() - 180000).toLocaleTimeString()}] Upload complete (42.0 MB).`,
      `[${new Date(Date.now() - 150000).toLocaleTimeString()}] Audio transcribed. 5 text segments extracted.`,
      `[${new Date(Date.now() - 120000).toLocaleTimeString()}] Rulebook screening finished.`,
    ],
    violationCount: 0,
    complianceScore: 0,
    scoreStatus: "pending",
    posterVariant: "night",
    isDemo: true,
  },
];

/** Mark each script segment red/yellow/green from the violations whose terms it contains. */
export function applySegmentRisk(segments: TimestampedSegment[], violations: ComplianceViolation[]): TimestampedSegment[] {
  return segments.map((seg) => {
    const segViolations = violations.filter((v) =>
      v.flagged_terms.some((term) => seg.text.toLowerCase().includes(term.toLowerCase()))
    );
    const risk: TimestampedSegment['risk'] = segViolations.some((v) => v.traffic_light === 'RED')
      ? 'RED'
      : segViolations.some((v) => v.traffic_light === 'YELLOW')
      ? 'YELLOW'
      : 'GREEN';
    return { ...seg, violations: segViolations, risk };
  });
}

/** Every platform a post can target; a submitted post is screened for the ones it was submitted for. */
export const SCREENER_PLATFORMS: TargetPlatform[] = [
  'TIKTOK', 'YOUTUBE', 'YOUTUBE_SHORTS', 'LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'X', 'REDDIT', 'WEBSITE',
];
const SHOW_DEMO_KEY = 'contentScreener.showDemo';

/** Turn a submitted video into a queue item the Content Screener can play and score. */
/** An earlier version of a submitted item, as it was, for the Screener's version picker. Always read-only. */
export function versionQueueItem(latest: VideoQueueItem, v: VersionView): VideoQueueItem | null {
  if (!v.video || !latest.submissionId) return null;
  const jobStatus = v.review_job?.status;
  const status = (jobStatus === 'AWAITING_REVIEW' ? 'IN_REVIEW' : jobStatus ?? 'IN_REVIEW') as SubmissionStatus;
  const item = toQueueItem({
    id: latest.submissionId,
    reference_code: latest.referenceCode ?? '',
    title: v.snapshot.title ?? latest.title,
    status,
    platforms: v.snapshot.platforms ?? latest.platforms ?? [],
    account: null,
    caption_text: v.snapshot.caption_text ?? null,
    latest_check: v.check ?? null,
    current_version: v.version_number,
    submitted_at: v.created_at,
    creator_name: latest.creatorName ?? null,
    video: v.video,
    can_review: false,
    publish_at: v.snapshot.publish_at ?? null,
  } as ReviewQueueItem);
  return {
    ...item,
    id: `${latest.id}@v${v.version_number}`,
    platform: latest.platform,
    aspectRatio: latest.aspectRatio,
    queueTab: 'done',
    canReview: false,
    canManageApproval: false,
    dueAt: null,
    dueKind: null,
  };
}

function toQueueItem(s: ReviewQueueItem): VideoQueueItem {
  // The first platform it was submitted for (or its account's); YouTube only when it has neither.
  const platform =
    (s.platforms.find((p) => SCREENER_PLATFORMS.includes(p as TargetPlatform)) as TargetPlatform | undefined) ??
    (SCREENER_PLATFORMS.includes(s.account?.platform as TargetPlatform) ? (s.account!.platform as TargetPlatform) : 'YOUTUBE');
  const check = s.latest_check;
  // Image, carousel and text posts have no video: no player, no transcript, previewed from their images.
  const video = s.video ?? null;
  // The backend transcribes the video's speech after upload; until it's done the script is empty.
  const raw = (video?.transcript_status === 'COMPLETED' ? video.transcript ?? [] : []).map((seg, i) => ({
    id: `${video!.id}-t${i}`,
    startSec: seg.start_sec,
    endSec: seg.end_sec,
    text: seg.text,
    onScreen: seg.source === 'on_screen',
  }));
  // Prefer the server's per-segment flags (same matcher as the score); fall back for checks made before them.
  const flags = check?.segment_flags;
  const segments =
    flags && flags.length === raw.length
      ? raw.map((seg, i) => {
          const f = flags[i];
          const violations = (check?.violations ?? []).filter((v) => f.rule_numbers.includes(v.rule_number));
          return { ...seg, risk: f.traffic_light, violations };
        })
      : applySegmentRisk(raw, check?.violations ?? []);
  return {
    id: `sub-${s.id}`,
    submissionId: s.id,
    referenceCode: s.reference_code,
    caption: s.caption_text,
    creatorName: s.creator_name,
    filename: video?.original_name ?? s.images?.[0]?.original_name ?? s.title,
    title: s.title,
    platform,
    aspectRatio: platform === 'TIKTOK' || platform === 'YOUTUBE_SHORTS' ? '9:16' : '16:9',
    totalSizeBytes: video?.size_bytes ?? 0,
    uploadedBytes: video?.size_bytes ?? 0,
    uploadSpeedBps: 0,
    progressPercent: 100,
    status: 'COMPLETED',
    currentStageIndex: 4,
    currentStageLabel: 'Submitted for review',
    estimatedSecondsRemaining: 0,
    createdAt: s.submitted_at || video?.created_at || '',
    completedAt: s.submitted_at,
    videoUrl: video ? authedFileUrl(video.url) : null,
    videoFileId: video?.id,
    transcriptStatus: video?.transcript_status ?? null,
    transcriptError: video?.transcript_error ?? null,
    contentType: s.content_type ?? null,
    images: (s.images ?? []).map((f) => ({ id: f.id, url: authedFileUrl(f.url), name: f.original_name })),
    segments,
    logs: [],
    violationCount: check?.violations_count ?? 0,
    complianceScore: check?.score ?? 0,
    scoreStatus: !check ? 'pending' : isAnalysing(check) ? 'analysing' : 'checked',
    serverCheck: check ?? null,
    submissionStatus: s.status,
    currentVersion: s.current_version,
    platforms: s.platforms,
    publishAt: s.publish_at ?? null,
    dueAt: s.due_at ?? null,
    dueKind: s.due_kind ?? null,
    canReview: Boolean(s.can_review),
    queueTab: tabOf(s.status),
    canApprove: s.can_approve ?? Boolean(s.can_review),
    approverNames: s.approver_names ?? [],
    openCriticalFlags: s.open_critical_flags ?? 0,
    approvalScore: s.approval_score ?? null,
    minApprovalScore: s.min_approval_score,
    createdBy: s.created_by ?? null,
    canManageApproval: Boolean(s.can_manage_approval),
    decidedAt: s.decided_at ?? null,
  };
}

export function VideoUploadQueueProvider({ children }: { children: React.ReactNode }) {
  // Sample videos and anything added locally; real submissions come from the API below.
  const [localQueue, setQueue] = useState<VideoQueueItem[]>(INITIAL_QUEUE);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);
  const [showDemoPref, setShowDemoPref] = useState<boolean | null>(() => {
    try {
      const v = localStorage.getItem(SHOW_DEMO_KEY);
      return v === null ? null : v === 'true';
    } catch {
      return null;
    }
  });

  const { user, creatorView } = useAuth();
  // A super admin viewing the app as a creator sees only their own content, as its creator.
  const queueScope = creatorView ? 'mine' : 'all';
  const [doneSearch, setDoneSearch] = useState('');
  // Each tab is its own list on the server, so decided content can't crowd out what's waiting.
  const tabQueries = useQueries({
    queries: QUEUE_TABS.map((tab) => {
      const search = tab === 'done' ? doneSearch.trim() : '';
      return {
        queryKey: ['review-queue', tab, search, queueScope],
        queryFn: () => submissionService.reviewQueue(tab, search || undefined, queueScope),
        enabled: Boolean(user),
        staleTime: 0,
        // Keep showing the list while a search is typed, but never another view's list (e.g. reviewer items,
        // with their review actions, after switching to the creator view).
        placeholderData: (previous: ReviewQueueItem[] | undefined, previousQuery?: { queryKey: readonly unknown[] }) =>
          previousQuery?.queryKey[3] === queueScope ? previous : undefined,
        // Check back quickly while a post is still being read (its video, images or script), otherwise once a minute.
        refetchInterval: (query: { state: { data?: ReviewQueueItem[] } }) =>
          query.state.data?.some((s) => isAnalysing(s.latest_check)) ? 5_000 : 60_000,
      };
    }),
  });
  const countsQuery = useQuery({
    queryKey: ['review-queue', 'counts', queueScope],
    queryFn: () => submissionService.reviewQueueCounts(queueScope),
    enabled: Boolean(user),
    staleTime: 0,
    refetchInterval: 60_000,
  });
  const [reviewRows, sentBackRows, doneRows] = tabQueries.map((q) => q.data);
  const serverItems = useMemo(() => {
    // Submitted items always show the server's check, so every screen agrees on the score.
    const seen = new Set<string>();
    return [reviewRows, sentBackRows, doneRows]
      .flatMap((rows) => rows ?? [])
      .filter((s) => !seen.has(s.id) && seen.add(s.id))
      .map(toQueueItem);
  }, [reviewRows, sentBackRows, doneRows]);
  const serverLoading = tabQueries.some((q) => q.isLoading);

  // The built-in sample videos are for super admins setting up or demonstrating the app; reviewers and creators
  // only ever see real content. Without a saved preference, they show while there's no real content to review.
  const showDemo = Boolean(user?.is_super_admin) && !creatorView && (showDemoPref ?? serverItems.length === 0);
  const setShowDemo = useCallback((show: boolean) => {
    setShowDemoPref(show);
    try {
      localStorage.setItem(SHOW_DEMO_KEY, String(show));
    } catch {
      // preference just won't persist
    }
  }, []);

  const queue = useMemo(
    () => [...serverItems, ...localQueue.filter((item) => !item.isDemo || showDemo)],
    [serverItems, localQueue, showDemo]
  );

  const activeVideo = useMemo(() => {
    return queue.find((item) => item.id === activeVideoId) || queue[0] || null;
  }, [queue, activeVideoId]);

  const activeUploadCount = useMemo(() => {
    return queue.filter((item) => item.status === "UPLOADING" || item.status === "PROCESSING").length;
  }, [queue]);

  const totalQueueCount = useMemo(() => {
    return queue.filter((item) => item.status !== "COMPLETED" && item.status !== "FAILED").length;
  }, [queue]);

  // Score every item with the same live rulebook check the Content Screener uses. Hidden sample videos
  // aren't scored (they're scored when shown), and nothing runs until the real queue has loaded.
  const checksInFlight = useRef(new Set<string>());
  const queueLoading = serverLoading;
  useEffect(() => {
    if (queueLoading) return;
    localQueue
      .filter((item) => item.scoreStatus === 'pending' && (!item.isDemo || showDemo) && !checksInFlight.current.has(item.id))
      .forEach((item) => {
        checksInFlight.current.add(item.id);
        complianceService
          .checkCompliance({
            text: item.segments.map((s) => s.text).join(' '),
            video_title: item.title,
            content_type: `VIDEO_${item.platform}`,
          })
          .then((res) => {
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      complianceScore: res.score,
                      violationCount: res.violations_count,
                      segments: applySegmentRisk(q.segments, res.violations),
                      scoreStatus: 'checked',
                    }
                  : q
              )
            );
          })
          .catch(() => {
            setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, scoreStatus: 'error' } : q)));
          })
          .finally(() => checksInFlight.current.delete(item.id));
      });
  }, [localQueue, showDemo, queueLoading]);

  const recordScanResult = useCallback(
    (id: string, result: { score: number; violationCount: number; segments: TimestampedSegment[] }) => {
      // Submitted items are scored by the server; only local demo items take live scan results.
      if (id.startsWith('sub-')) return;
      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? { ...q, complianceScore: result.score, violationCount: result.violationCount, segments: result.segments, scoreStatus: 'checked' }
            : q
        )
      );
    },
    []
  );

  const openQueueDrawer = useCallback(() => setIsQueueDrawerOpen(true), []);
  const closeQueueDrawer = useCallback(() => setIsQueueDrawerOpen(false), []);

  // Background progress advancement for simulation / real-time feel
  useEffect(() => {
    const timer = setInterval(() => {
      setQueue((prevQueue) => {
        let hasChanges = false;
        const next = prevQueue.map((item) => {
          if (item.status === "UPLOADING" || item.status === "PROCESSING") {
            hasChanges = true;
            const newProgress = Math.min(100, item.progressPercent + 3);
            const newUploadedBytes = Math.min(
              item.totalSizeBytes,
              Math.round((item.totalSizeBytes * newProgress) / 100)
            );
            const remainingSec = Math.max(0, Math.ceil((100 - newProgress) / 3));

            let stageIndex = 0;
            let stageLabel = "File Codec & Checksum Verification";
            if (newProgress >= 25 && newProgress < 50) {
              stageIndex = 1;
              stageLabel = "Audio Stream Extraction & Normalization";
            } else if (newProgress >= 50 && newProgress < 75) {
              stageIndex = 2;
              stageLabel = "Gemini Speech-to-Text Transcription";
            } else if (newProgress >= 75 && newProgress < 95) {
              stageIndex = 3;
              stageLabel = "Defense Visual & Insignia OCR Analysis";
            } else if (newProgress >= 95) {
              stageIndex = 4;
              stageLabel = "Defense Thought Leadership Rulebook Check";
            }

            const isDone = newProgress >= 100;

            let logs = item.logs;
            if (isDone) {
              logs = [
                ...item.logs,
                `[${new Date().toLocaleTimeString()}] 100% upload finished. All AI compliance verification checks cleared.`,
              ];
            }

            return {
              ...item,
              progressPercent: newProgress,
              uploadedBytes: newUploadedBytes,
              currentStageIndex: stageIndex,
              currentStageLabel: isDone ? "Compliance Screening & Clearance Complete" : stageLabel,
              estimatedSecondsRemaining: remainingSec,
              status: isDone ? ("COMPLETED" as VideoQueueStatus) : ("UPLOADING" as VideoQueueStatus),
              completedAt: isDone ? new Date().toISOString() : item.completedAt,
              logs,
            };
          }
          return item;
        });

        // If an uploading item finished, promote the first queued item to UPLOADING!
        const currentlyUploading = next.some((i) => i.status === "UPLOADING" || i.status === "PROCESSING");
        if (!currentlyUploading) {
          const firstQueuedIndex = next.findIndex((i) => i.status === "QUEUED");
          if (firstQueuedIndex !== -1) {
            hasChanges = true;
            next[firstQueuedIndex] = {
              ...next[firstQueuedIndex],
              status: "UPLOADING",
              progressPercent: 5,
              currentStageLabel: "Streaming Initial Chunks & Checksum",
              uploadSpeedBps: 5.2 * 1024 * 1024,
              logs: [
                ...next[firstQueuedIndex].logs,
                `[${new Date().toLocaleTimeString()}] Started upload from queue. Buffer active for early preview.`,
              ],
            };
          }
        }

        return hasChanges ? next : prevQueue;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  const addToQueue = useCallback(
    ({
      file,
      filename,
      title,
      platform = 'TIKTOK',
      aspectRatio,
      sizeBytes,
    }: {
      file?: File;
      filename?: string;
      title?: string;
      platform?: TargetPlatform;
      aspectRatio?: '9:16' | '16:9';
      sizeBytes?: number;
    }) => {
      const actualFilename = file ? file.name : filename || 'defense_cut_' + Date.now() + '.mp4';
      const actualTitle = title || (file ? file.name.replace(/\.[^/.]+$/, '') : 'New Defense Asset Scan');
      const actualAspect = aspectRatio || (platform === 'TIKTOK' || platform === 'YOUTUBE_SHORTS' ? '9:16' : '16:9');
      const actualSize = file ? file.size : sizeBytes || 52 * 1024 * 1024;
      const url = file ? URL.createObjectURL(file) : null;

      const newItem: VideoQueueItem = {
        id: 'job-' + Date.now(),
        filename: actualFilename,
        title: actualTitle,
        platform,
        aspectRatio: actualAspect,
        totalSizeBytes: actualSize,
        uploadedBytes: Math.round(actualSize * 0.15),
        uploadSpeedBps: 4.5 * 1024 * 1024,
        progressPercent: 15,
        status: 'UPLOADING',
        currentStageIndex: 0,
        currentStageLabel: 'Streaming Initial Chunks & Checksum',
        estimatedSecondsRemaining: 18,
        createdAt: new Date().toISOString(),
        videoUrl: url,
        file: file || null,
        segments: DEMO_SEGMENTS_1,
        logs: [
          `[${new Date().toLocaleTimeString()}] Upload started for ${actualFilename}. Progressive stream buffer active.`,
        ],
        violationCount: 0,
        complianceScore: 0,
        scoreStatus: 'pending',
      };

      setQueue((prev) => [newItem, ...prev]);
      setActiveVideoId(newItem.id);
      toast.success(`Added "${actualTitle}" to video upload queue! Early chunks are available for review.`);
      return newItem;
    },
    []
  );

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
    toast.info('Removed video from queue.');
  }, []);

  const retryItem = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            status: 'UPLOADING',
            progressPercent: 10,
            uploadedBytes: Math.round(item.totalSizeBytes * 0.1),
            currentStageLabel: 'Restarting Upload Stream',
            logs: [...item.logs, `[${new Date().toLocaleTimeString()}] Retrying upload pipeline.`],
          };
        }
        return item;
      })
    );
    toast.success('Retrying video upload pipeline.');
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((item) => item.status !== 'COMPLETED'));
    toast.info('Cleared completed items from queue.');
  }, []);

  const simulateAdvanceActive = useCallback(() => {
    if (!activeVideoId) return;
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === activeVideoId) {
          const nextP = Math.min(100, item.progressPercent + 25);
          return {
            ...item,
            progressPercent: nextP,
            uploadedBytes: Math.round((item.totalSizeBytes * nextP) / 100),
            status: nextP >= 100 ? 'COMPLETED' : item.status,
            logs: [...item.logs, `[${new Date().toLocaleTimeString()}] Advanced chunk buffer to ${nextP}%.`],
          };
        }
        return item;
      })
    );
  }, [activeVideoId]);

  return (
    <VideoUploadQueueContext.Provider
      value={{
        queue,
        activeVideoId,
        activeVideo,
        isQueueDrawerOpen,
        setIsQueueDrawerOpen,
        openQueueDrawer,
        closeQueueDrawer,
        setActiveVideoId,
        addToQueue,
        removeFromQueue,
        retryItem,
        clearCompleted,
        activeUploadCount,
        totalQueueCount,
        simulateAdvanceActive,
        recordScanResult,
        showDemo,
        setShowDemo,
        serverQueueLoading: serverLoading,
        queueCounts: countsQuery.data ?? null,
        doneSearch,
        setDoneSearch,
      }}
    >
      {children}
    </VideoUploadQueueContext.Provider>
  );
}

export function useVideoUploadQueue() {
  const context = useContext(VideoUploadQueueContext);
  if (!context) {
    throw new Error('useVideoUploadQueue must be used within a VideoUploadQueueProvider');
  }
  return context;
}
