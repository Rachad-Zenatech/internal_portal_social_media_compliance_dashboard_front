import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

export type TargetPlatform = 'TIKTOK' | 'YOUTUBE' | 'YOUTUBE_SHORTS' | 'LINKEDIN';
export type VideoQueueStatus = 'QUEUED' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PAUSED';

export interface TimestampedSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  violations?: any[];
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
  violationCount: number;
  complianceScore: number;
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
    text: "Defense contract award pending final congressional sign-off. High yield optics detected.",
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
    violationCount: 2,
    complianceScore: 68,
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
    violationCount: 1,
    complianceScore: 82,
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
      `[${new Date(Date.now() - 120000).toLocaleTimeString()}] Rulebook screening finished. 2 Critical DoD flags detected.`,
    ],
    violationCount: 2,
    complianceScore: 68,
  },
];

export function VideoUploadQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<VideoQueueItem[]>(INITIAL_QUEUE);
  const [activeVideoId, setActiveVideoId] = useState<string | null>("job-uploading-001");
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);

  const activeVideo = useMemo(() => {
    return queue.find((item) => item.id === activeVideoId) || queue[0] || null;
  }, [queue, activeVideoId]);

  const activeUploadCount = useMemo(() => {
    return queue.filter((item) => item.status === "UPLOADING" || item.status === "PROCESSING").length;
  }, [queue]);

  const totalQueueCount = useMemo(() => {
    return queue.filter((item) => item.status !== "COMPLETED" && item.status !== "FAILED").length;
  }, [queue]);

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
        violationCount: 2,
        complianceScore: 74,
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
