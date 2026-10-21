import { useState, useRef, useEffect, useMemo } from "react";
import {
  Upload,
  Video,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  FileText,
  Volume2,
  VolumeX,
  Check,
  ShieldAlert,
  Download,
  Film,
  Zap,
  Smartphone,
  Monitor,
  Copy,
  Hash,
  MessageSquare,
  Send,
  Trash2,
  User as UserIcon,
  Loader2,
  ChevronDown,
  ChevronUp,
  Radio,
  SkipBack,
  SkipForward,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import {
  complianceService,
  type ComplianceCheckResponse,
  type ComplianceViolation,
  type VideoJob,
} from "@/services/complianceService";

export type TargetPlatform = "YOUTUBE" | "TIKTOK" | "YOUTUBE_SHORTS" | "LINKEDIN";

export interface TimestampedSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  violations?: ComplianceViolation[];
  risk?: "RED" | "YELLOW" | "GREEN";
}

export type CommentCategory = "LEGAL" | "EDITORIAL" | "COMPLIANCE" | "NOTE";

export interface ReviewerComment {
  id: string;
  author: string;
  timestampSec: number | null;
  endTimestampSec?: number | null;
  category: CommentCategory;
  text: string;
  createdAt: string;
}

const MANDATORY_DOD_DISCLAIMER =
  "The appearance of U.S. Department of Defense (DoD) visual information does not imply or constitute DoD endorsement.";

const SAMPLE_DEMO_SEGMENTS: TimestampedSegment[] = [
  {
    id: "seg-1",
    startSec: 0,
    endSec: 8,
    text: "Welcome to ZenaDrone. Today we showcase our next-generation autonomous flight telemetry in real-time field trials.",
    risk: "GREEN",
  },
  {
    id: "seg-2",
    startSec: 9,
    endSec: 19,
    text: "ZenaDrone has partnered with the U.S. Army to deliver combat-proven autonomous swarm logistics across front-line operations.",
    risk: "RED",
  },
  {
    id: "seg-3",
    startSec: 20,
    endSec: 32,
    text: "Pentagon procurement is failing our warfighters, but our fielded drone system is already adopted by active military commanders.",
    risk: "RED",
  },
  {
    id: "seg-4",
    startSec: 33,
    endSec: 46,
    text: "With sub-second dual sensor payloads, the ZenaDrone 1000 provides unjammable target locking under extreme ECM warfare environments.",
    risk: "YELLOW",
  },
  {
    id: "seg-5",
    startSec: 47,
    endSec: 60,
    text: "For more details on commercial autonomous logistics and civil infrastructure defense applications, visit zenatech.com.",
    risk: "GREEN",
  },
];

export default function VideoComplianceScannerPage() {
  const { user } = useAuth();
  const authorName = user?.full_name || "Marketing Reviewer";
  const {
    queue,
    activeVideo,
    activeVideoId,
    setActiveVideoId,
    openQueueDrawer,
    addToQueue,
    activeUploadCount,
  } = useVideoUploadQueue();

  const [platform, setPlatform] = useState<TargetPlatform>("TIKTOK");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("9:16");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("ZenaDrone Defense Swarm Logistics Field Demonstration");

  // Partial / Progressive Upload State
  const [partialUploadMode, setPartialUploadMode] = useState(false);
  const [partialUploadPercent, setPartialUploadPercent] = useState(100);

  // Sync state with activeVideo from the upload queue
  useEffect(() => {
    if (activeVideo) {
      setVideoTitle(activeVideo.title);
      setPlatform(activeVideo.platform);
      setAspectRatio(activeVideo.aspectRatio);
      if (activeVideo.segments && activeVideo.segments.length > 0) {
        setSegments(activeVideo.segments);
        setFullTranscript(activeVideo.segments.map((s) => s.text).join(" "));
      }
      if (activeVideo.videoUrl) {
        setVideoUrl(activeVideo.videoUrl);
      }
      if (activeVideo.status === "UPLOADING" || activeVideo.status === "PROCESSING") {
        setPartialUploadMode(true);
        setPartialUploadPercent(activeVideo.progressPercent);
      } else {
        setPartialUploadMode(false);
        setPartialUploadPercent(100);
      }
    }
  }, [activeVideo?.id, activeVideo?.progressPercent]);

  // Platform specific metadata
  const [youtubeDescription, setYoutubeDescription] = useState(
    "Experience autonomous drone fleet operations with ZenaDrone 1000.\n\nLearn more at https://zenatech.com\n\nDisclaimer: " +
      MANDATORY_DOD_DISCLAIMER
  );
  const [tiktokCaption, setTiktokCaption] = useState(
    "Next-gen autonomous logistics in action! High-durability payload trials with #ZenaDrone. #DefenseTech #Drones #TechInnovation"
  );

  const [fullTranscript, setFullTranscript] = useState(
    SAMPLE_DEMO_SEGMENTS.map((s) => s.text).join(" ")
  );
  const [segments, setSegments] = useState<TimestampedSegment[]>(SAMPLE_DEMO_SEGMENTS);

  // Background Job Processing State
  const [activeJob, setActiveJob] = useState<VideoJob | null>(null);
  const [isJobExpanded, setIsJobExpanded] = useState(true);
  const pollingIntervalRef = useRef<any>(null);

  // Reviewer Comments
  const [comments, setComments] = useState<ReviewerComment[]>([
    {
      id: "comm-1",
      author: "Legal Counsel",
      timestampSec: 9,
      endTimestampSec: 19,
      category: "LEGAL",
      text: "Replace 'partnered with the U.S. Army' with 'field-tested under active evaluation agreements' to satisfy non-endorsement standards.",
      createdAt: "Today at 2:15 PM",
    },
    {
      id: "comm-2",
      author: "PR & Comms Lead",
      timestampSec: 20,
      endTimestampSec: 32,
      category: "EDITORIAL",
      text: "Soften commentary on Pentagon procurement—align with positive defense innovation framing.",
      createdAt: "Today at 2:20 PM",
    },
    {
      id: "comm-3",
      author: "Social Media Producer",
      timestampSec: 47,
      endTimestampSec: 60,
      category: "NOTE",
      text: "Ensure URL text overlay stays within TikTok 9:16 safe area (avoid bottom caption zone).",
      createdAt: "Today at 2:25 PM",
    },
  ]);

  const [commentInput, setCommentInput] = useState("");
  const [commentCategory, setCommentCategory] = useState<CommentCategory>("LEGAL");
  const [commentTimeMode, setCommentTimeMode] = useState<"POINT" | "RANGE" | "NONE">("POINT");
  const [rangeStartSec, setRangeStartSec] = useState<number>(0);
  const [rangeEndSec, setRangeEndSec] = useState<number>(10);
  const [activeCommentId, setActiveCommentId] = useState<string | null>("comm-1");

  // Playback state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Drag-and-drop upload queue & player dropzone state
  const [isDraggingOverQueue, setIsDraggingOverQueue] = useState(false);
  const [isDraggingOverPlayer, setIsDraggingOverPlayer] = useState(false);
  const queueDragCounterRef = useRef(0);
  const playerDragCounterRef = useRef(0);
  const queueFileInputRef = useRef<HTMLInputElement | null>(null);
  const [queueViewMode, setQueueViewMode] = useState<"grid" | "list">("grid");
  const [isQueueCollapsed, setIsQueueCollapsed] = useState(false);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ComplianceCheckResponse | null>(null);
  const [selectedViolation, setSelectedViolation] = useState<ComplianceViolation | null>(null);

  // Effective buffered progress percentage & maximum reviewable timestamp
  const effectiveUploadPercent = useMemo(() => {
    if (partialUploadMode) return partialUploadPercent;
    if (activeJob && activeJob.status === "PROCESSING") {
      return Math.max(25, activeJob.progress_percent);
    }
    return 100;
  }, [partialUploadMode, partialUploadPercent, activeJob]);

  const maxBufferedSec = useMemo(() => {
    return Math.max(12, Math.round((duration * effectiveUploadPercent) / 100));
  }, [duration, effectiveUploadPercent]);

  // Update default aspect ratio when platform changes
  const handlePlatformChange = (p: TargetPlatform) => {
    setPlatform(p);
    if (p === "TIKTOK" || p === "YOUTUBE_SHORTS") {
      setAspectRatio("9:16");
    } else {
      setAspectRatio("16:9");
    }
  };

  // Launch Background Job Pipeline
  const startBackgroundJob = async (fileObj?: File, customTitle?: string) => {
    const filename = fileObj ? fileObj.name : "demo_field_trial.mp4";
    const title = customTitle || videoTitle;

    setIsJobExpanded(true);
    setPartialUploadMode(true);
    setPartialUploadPercent(25);

    try {
      const job = await complianceService.startVideoJob({
        filename,
        video_title: title,
        platform,
        aspect_ratio: aspectRatio,
      });
      setActiveJob(job);
      toast.info(`Started upload & pipeline for ${filename}. Early chunks are reviewable immediately!`);

      // Begin polling job progress
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const updated = await complianceService.getVideoJob(job.job_id);
          setActiveJob(updated);
          setPartialUploadPercent(updated.progress_percent);

          if (updated.status === "COMPLETED") {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setPartialUploadMode(false);
            setPartialUploadPercent(100);
            toast.success("100% video upload complete! All pipeline stages finished.");
            handleRunScan();
          }
        } catch {
          // If polling endpoint fails, simulate client progression
          simulateLocalPipelineProgression();
        }
      }, 1200);
    } catch {
      simulateLocalPipelineProgression(filename, title);
    }
  };

  // Local fallback simulation if backend offline
  const simulateLocalPipelineProgression = (filename?: string, title?: string) => {
    const mockJob: VideoJob = {
      job_id: "local-" + Date.now(),
      filename: filename || (videoFile ? videoFile.name : "demo_field_trial.mp4"),
      video_title: title || videoTitle,
      platform,
      aspect_ratio: aspectRatio,
      status: "PROCESSING",
      progress_percent: 25,
      current_stage_index: 0,
      current_stage: "UPLOADING",
      current_stage_label: "Streaming Initial Chunks & Checksum",
      stages: [
        { id: "UPLOADING", label: "File Codec & Checksum Verification", status: "IN_PROGRESS" },
        { id: "AUDIO_EXTRACTION", label: "Audio Stream Extraction & Normalization", status: "PENDING" },
        { id: "SPEECH_TRANSCRIBING", label: "Gemini Speech-to-Text Transcription", status: "PENDING" },
        { id: "DEFENSE_VISUAL_OCR", label: "Defense Visual & Insignia OCR Analysis", status: "PENDING" },
        { id: "COMPLIANCE_SCREENING", label: "Defense Thought Leadership Rulebook Check", status: "PENDING" },
      ],
      logs: [
        `[${new Date().toLocaleTimeString()}] Chunk 01 uploaded (12.4 MB). Ready for immediate playback review.`,
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setActiveJob(mockJob);
    setPartialUploadMode(true);
    setPartialUploadPercent(25);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progressSteps = [25, 45, 70, 85, 100];
      const nextProgress = progressSteps[step] || 100;
      setPartialUploadPercent(nextProgress);

      setActiveJob((prev) => {
        if (!prev) return null;
        const stages = prev.stages.map((stg, i) => {
          if (i < step) return { ...stg, status: "COMPLETED" as const };
          if (i === step) return { ...stg, status: "IN_PROGRESS" as const };
          return { ...stg, status: "PENDING" as const };
        });

        const stageNames = [
          "Streaming Initial Chunks & Checksum",
          "Audio Stream Extraction & Normalization",
          "Gemini Speech-to-Text Transcription",
          "Defense Visual & Insignia OCR Analysis",
          "Defense Thought Leadership Rulebook Check",
        ];

        const logMessages = [
          `[${new Date().toLocaleTimeString()}] Chunk 02 uploaded. Buffer extended to ${Math.round((60 * nextProgress) / 100)}s.`,
          `[${new Date().toLocaleTimeString()}] Audio demuxed. 16kHz vocal track prepared.`,
          `[${new Date().toLocaleTimeString()}] Gemini Speech model transcribed 5 segments.`,
          `[${new Date().toLocaleTimeString()}] Keyframes scanned for restricted markings.`,
          `[${new Date().toLocaleTimeString()}] Full upload and rulebook screening complete!`,
        ];

        const isDone = step >= 4;
        if (isDone) {
          clearInterval(interval);
          setPartialUploadMode(false);
          setPartialUploadPercent(100);
          toast.success("100% video upload complete! All segments available.");
          handleRunScan();
        }

        return {
          ...prev,
          progress_percent: nextProgress,
          current_stage_index: step,
          current_stage_label: stageNames[step] || "Completed",
          status: isDone ? "COMPLETED" : "PROCESSING",
          stages,
          logs: [...prev.logs, logMessages[step] || "Step completed."],
        };
      });
    }, 1800);
  };

  // Handle Video Upload
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(file.name)) {
      toast.error("Please upload a valid video file (.mp4, .mov, .webm)");
      return;
    }
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
    setVideoTitle(cleanTitle);
    toast.success(`Loaded video: ${file.name}`);

    // Add to global upload queue
    const queuedItem = addToQueue({ file, platform, aspectRatio });
    if (queuedItem) {
      setActiveVideoId(queuedItem.id);
    }

    // Auto-trigger background pipeline with partial review available immediately
    startBackgroundJob(file, cleanTitle);
  };

  // Handle Drag & Drop of one or multiple video files
  const handleDropFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const videoFiles = fileArray.filter(
      (f) => f.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(f.name)
    );

    if (videoFiles.length === 0) {
      toast.error("Please drop valid video files (.mp4, .mov, .webm)");
      return;
    }

    // Queue all dropped files, setting the first as active in player
    const reversed = [...videoFiles].reverse();
    let firstItem: any = null;

    reversed.forEach((f) => {
      const added = addToQueue({ file: f, platform, aspectRatio });
      firstItem = added;
    });

    const firstFile = videoFiles[0];
    setVideoFile(firstFile);
    const url = URL.createObjectURL(firstFile);
    setVideoUrl(url);
    const cleanTitle = firstFile.name.replace(/\.[^/.]+$/, "");
    setVideoTitle(cleanTitle);

    if (firstItem) {
      setActiveVideoId(firstItem.id);
    }
    startBackgroundJob(firstFile, cleanTitle);

    if (videoFiles.length > 1) {
      toast.success(`Queued ${videoFiles.length} videos. "${firstFile.name}" active in player.`);
    }
  };

  // Queue Drag & Drop Event Handlers
  const handleQueueDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    queueDragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOverQueue(true);
    }
  };

  const handleQueueDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    queueDragCounterRef.current -= 1;
    if (queueDragCounterRef.current <= 0) {
      queueDragCounterRef.current = 0;
      setIsDraggingOverQueue(false);
    }
  };

  const handleQueueDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleQueueDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    queueDragCounterRef.current = 0;
    setIsDraggingOverQueue(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleDropFiles(e.dataTransfer.files);
    }
  };

  // Player Viewport Drag & Drop Event Handlers
  const handlePlayerDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playerDragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOverPlayer(true);
    }
  };

  const handlePlayerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playerDragCounterRef.current -= 1;
    if (playerDragCounterRef.current <= 0) {
      playerDragCounterRef.current = 0;
      setIsDraggingOverPlayer(false);
    }
  };

  const handlePlayerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handlePlayerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playerDragCounterRef.current = 0;
    setIsDraggingOverPlayer(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleDropFiles(e.dataTransfer.files);
    }
  };

  // High-precision 60fps requestAnimationFrame loop for ultra-smooth playback & playhead glide
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const onFrame = (now: number) => {
      if (videoRef.current && videoUrl) {
        // Query exact video currentTime directly on every animation frame (60fps)
        const exactTime = videoRef.current.currentTime;
        setCurrentTime(exactTime);

        // Guard against playing past unbuffered chunk in progressive mode
        if (effectiveUploadPercent < 100 && exactTime >= maxBufferedSec) {
          videoRef.current.pause();
          setIsPlaying(false);
          toast.warning(
            `Reached end of buffered stream (${formatTime(maxBufferedSec)}). Remaining chunks are transferring.`
          );
          return;
        }

        if (videoRef.current.ended) {
          setIsPlaying(false);
          return;
        }
      } else {
        // Simulated / Demo video playback (smooth 60fps)
        if (lastTimeRef.current !== null) {
          const deltaSec = ((now - lastTimeRef.current) / 1000) * playbackRate;
          setCurrentTime((prev) => {
            const next = prev + deltaSec;
            if (effectiveUploadPercent < 100 && next >= maxBufferedSec) {
              setIsPlaying(false);
              toast.warning(
                `Reached end of buffered stream (${formatTime(maxBufferedSec)}). Remaining chunks are transferring.`
              );
              return maxBufferedSec;
            }
            if (next >= duration) {
              setIsPlaying(false);
              return duration;
            }
            return next;
          });
        }
        lastTimeRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(onFrame);
    };

    animationFrameRef.current = requestAnimationFrame(onFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, videoUrl, effectiveUploadPercent, maxBufferedSec, duration, playbackRate]);

  // Video time tracking fallback
  const handleTimeUpdate = () => {
    if (videoRef.current && !isPlaying) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 60);
      videoRef.current.playbackRate = playbackRate;
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      // Loop back if at the end of duration or buffer
      if (currentTime >= duration || (effectiveUploadPercent < 100 && currentTime >= maxBufferedSec)) {
        seekTo(0);
      }
      if (videoRef.current && videoUrl) {
        videoRef.current.playbackRate = playbackRate;
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        lastTimeRef.current = performance.now();
        setIsPlaying(true);
      }
    }
  };

  // Seek handler with partial upload guard & user feedback
  const seekTo = (sec: number) => {
    if (effectiveUploadPercent < 100 && sec > maxBufferedSec) {
      toast.warning(
        `Moment at ${formatTime(sec)} is still uploading in background (${effectiveUploadPercent}% complete). Seeking to latest buffered segment at ${formatTime(maxBufferedSec)}.`
      );
      sec = maxBufferedSec;
    }

    const clamped = Math.max(0, Math.min(sec, duration));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    setCurrentTime(clamped);
  };

  // Sub-frame stepper for precision compliance review
  const stepTime = (deltaSec: number) => {
    seekTo(currentTime + deltaSec);
  };

  // Change playback speed
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    toast.info(`Playback speed set to ${rate}x`);
  };

  // Jump to specific timestamp and immediately pause playback at that exact frame
  const seekAndPause = (sec: number, label?: string) => {
    // 1. Immediately pause HTML5 video and 60fps rAF animation
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);

    // 2. Bound to buffered range if upload is in-progress
    if (effectiveUploadPercent < 100 && sec > maxBufferedSec) {
      toast.warning(
        `Moment at ${formatTime(sec)} is still uploading (${effectiveUploadPercent}% complete). Seeking to latest buffered segment at ${formatTime(maxBufferedSec)}.`
      );
      sec = maxBufferedSec;
    }

    const clamped = Math.max(0, Math.min(sec, duration));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    setCurrentTime(clamped);

    toast.info(
      label
        ? `Jumped to ${formatTime(clamped)} and paused (${label})`
        : `Jumped to ${formatTime(clamped)} and paused`
    );
  };

  // Add a new comment
  const handleAddComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentInput.trim()) {
      toast.error("Please enter a comment or reviewer note.");
      return;
    }

    let startSec: number | null = null;
    let endSec: number | null = null;

    if (commentTimeMode === "POINT") {
      startSec = Math.round(currentTime);
    } else if (commentTimeMode === "RANGE") {
      const s = Math.max(0, Math.min(rangeStartSec, duration));
      const end = Math.max(0, Math.min(rangeEndSec, duration));
      startSec = Math.min(s, end);
      endSec = Math.max(s, end);
    }

    const newComment: ReviewerComment = {
      id: "comm-" + Date.now(),
      author: authorName,
      timestampSec: startSec,
      endTimestampSec: endSec,
      category: commentCategory,
      text: commentInput.trim(),
      createdAt: "Just now",
    };

    setComments((prev) => [newComment, ...prev]);
    setCommentInput("");
    if (startSec !== null && endSec !== null) {
      toast.success(`Added range note: ${formatTime(startSec)} - ${formatTime(endSec)}`);
    } else if (startSec !== null) {
      toast.success(`Added note pinned at ${formatTime(startSec)}!`);
    } else {
      toast.success("Added general reviewer comment!");
    }
  };

  // Delete a comment
  const handleDeleteComment = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    toast.info("Comment removed.");
  };

  // Run AI Compliance Scan
  const handleRunScan = async () => {
    if (!fullTranscript.trim()) {
      toast.error("Please provide or transcribe video audio/narration first.");
      return;
    }
    setIsScanning(true);
    try {
      const additionalContext =
        platform === "YOUTUBE"
          ? `\n\nYouTube Description: ${youtubeDescription}`
          : `\n\nTikTok Caption: ${tiktokCaption}`;

      const res = await complianceService.checkCompliance({
        text: fullTranscript + additionalContext,
        video_title: videoTitle.trim() || undefined,
        content_type: `VIDEO_${platform}`,
      });
      setScanResult(res);

      const updatedSegments = segments.map((seg) => {
        const segViolations = res.violations.filter((v) =>
          v.flagged_terms.some((term) =>
            seg.text.toLowerCase().includes(term.toLowerCase())
          )
        );

        let risk: "RED" | "YELLOW" | "GREEN" = "GREEN";
        if (segViolations.some((v) => v.traffic_light === "RED")) {
          risk = "RED";
        } else if (segViolations.some((v) => v.traffic_light === "YELLOW")) {
          risk = "YELLOW";
        }

        return {
          ...seg,
          violations: segViolations,
          risk,
        };
      });

      setSegments(updatedSegments);

      if (res.is_compliant) {
        toast.success(`Cleared for ${platform}! No defense compliance violations detected.`);
      } else if (res.traffic_light === "RED") {
        toast.error(`Stop! ${res.violations_count} critical red-line violation(s) flagged.`);
      } else {
        toast.warning(`Review required: ${res.violations_count} claims need clearance.`);
      }
    } catch (err: any) {
      toast.error("Compliance scan failed: " + (err?.response?.data?.detail || err.message));
    } finally {
      setIsScanning(false);
    }
  };

  // Run sample initial scan on mount
  useEffect(() => {
    handleRunScan();
  }, [platform]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Active segment
  const activeSegment = useMemo(() => {
    return segments.find((s) => currentTime >= s.startSec && currentTime <= s.endSec);
  }, [currentTime, segments]);

  // Active reviewer comment
  const activeComment = useMemo(() => {
    return comments.find((c) => c.id === activeCommentId) || null;
  }, [comments, activeCommentId]);

  // Check if DoD disclaimer is present
  const hasDoDDisclaimer = useMemo(() => {
    return (
      youtubeDescription.toLowerCase().includes("does not imply or constitute dod endorsement") ||
      tiktokCaption.toLowerCase().includes("does not imply or constitute dod endorsement")
    );
  }, [youtubeDescription, tiktokCaption]);

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <DashboardHeader
        title="Video Compliance Screener (TikTok & YouTube)"
        subtitle="Review uploaded video cuts in real-time—even while the remainder of the file is still transferring in the background."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVideoUrl(null);
                setVideoFile(null);
                setActiveJob(null);
                setPartialUploadMode(false);
                setPartialUploadPercent(100);
                setSegments(SAMPLE_DEMO_SEGMENTS);
                setFullTranscript(SAMPLE_DEMO_SEGMENTS.map((s) => s.text).join(" "));
                setVideoTitle("ZenaDrone Defense Swarm Logistics Field Demonstration");
                handleRunScan();
              }}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo
            </Button>

            {/* View Upload Queue Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={openQueueDrawer}
              className="text-xs gap-1.5 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-bold shadow-2xs"
            >
              <Upload className={`w-3.5 h-3.5 text-blue-500 ${activeUploadCount > 0 ? "animate-bounce" : ""}`} />
              <span>Upload Queue ({queue.length})</span>
              {activeUploadCount > 0 && (
                <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0 ml-0.5">
                  {activeUploadCount} Active ({activeVideo?.progressPercent || 0}%)
                </Badge>
              )}
            </Button>

            {/* Incomplete Upload Simulation Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPartialUploadMode(true);
                setPartialUploadPercent(50);
                toast.info("Simulating Incomplete Upload: 50% buffered. Reviewing chunks 0:00 - 0:30 so far.");
              }}
              className="text-xs gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Radio className="w-3.5 h-3.5 text-amber-500" />
              Simulate Incomplete Upload (50%)
            </Button>

            <Button
              size="sm"
              onClick={() => startBackgroundJob()}
              disabled={activeJob?.status === "PROCESSING" || isScanning}
              className="text-xs font-semibold gap-1.5 bg-primary shadow-xs"
            >
              <Sparkles className={`w-3.5 h-3.5 ${activeJob?.status === "PROCESSING" || isScanning ? "animate-spin" : ""}`} />
              {activeJob?.status === "PROCESSING" ? "Uploading & Screening..." : isScanning ? "Scanning..." : "Trigger Background Job"}
            </Button>
          </div>
        }
      />

      {/* Video Upload & Processing Queue Banner / Interactive Card */}
      <Card
        onDragEnter={handleQueueDragEnter}
        onDragLeave={handleQueueDragLeave}
        onDragOver={handleQueueDragOver}
        onDrop={handleQueueDrop}
        className={`relative border-border/80 shadow-xs bg-card overflow-hidden transition-all duration-200 ${
          isDraggingOverQueue ? "ring-2 ring-primary border-primary shadow-md" : ""
        }`}
      >
        {/* Hidden File Picker Input for Queue */}
        <input
          ref={queueFileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleDropFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />

        {/* Drag & Drop Full Card Active Overlay */}
        {isDraggingOverQueue && (
          <div className="absolute inset-0 z-50 bg-background/90 dark:bg-zinc-950/90 backdrop-blur-xs border-2 border-dashed border-primary flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 pointer-events-none">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-3 shadow-lg ring-8 ring-primary/10">
              <Upload className="w-7 h-7 text-primary animate-bounce" />
            </div>
            <p className="text-base font-bold text-foreground">
              Drop Video Files to Add to Review Queue
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Release anywhere to upload and start progressive screening immediately in player.
            </p>
            <Badge className="mt-3 bg-primary text-primary-foreground text-xs px-2.5 py-0.5 font-medium">
              Accepts .mp4, .mov, .webm, .mkv (single or batch)
            </Badge>
          </div>
        )}

        <CardHeader className="p-4 bg-muted/20 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span>Video Upload & Review Queue</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-blue-500/30 text-blue-600 dark:text-blue-400">
                    {activeUploadCount} Transferring • {queue.filter((q) => q.status === "QUEUED").length} Queued • {queue.filter((q) => q.status === "COMPLETED").length} Screened
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Videos being uploaded and processed. Drag & drop video files anywhere here or click any item to preview.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Grid / List Mode Toggle */}
              <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-muted/40">
                <Button
                  size="icon"
                  variant={queueViewMode === "grid" ? "secondary" : "ghost"}
                  onClick={() => setQueueViewMode("grid")}
                  className="h-6 w-6 rounded-md"
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant={queueViewMode === "list" ? "secondary" : "ghost"}
                  onClick={() => setQueueViewMode("list")}
                  className="h-6 w-6 rounded-md"
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </Button>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => queueFileInputRef.current?.click()}
                className="text-xs h-7 gap-1 font-semibold"
              >
                <Upload className="w-3 h-3 text-primary" />
                Upload Video
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={openQueueDrawer}
                className="text-xs h-7 gap-1 font-semibold"
              >
                View Full Queue
              </Button>

              {/* Collapse / Uncollapse Toggle */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsQueueCollapsed(!isQueueCollapsed)}
                className="text-xs h-7 gap-1 font-semibold text-muted-foreground hover:text-foreground px-2"
                title={isQueueCollapsed ? "Expand queue items" : "Collapse queue items"}
              >
                <span>{isQueueCollapsed ? "Expand" : "Collapse"}</span>
                {isQueueCollapsed ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Collapsed State Bar */}
        {isQueueCollapsed ? (
          <div className="px-4 py-3 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2.5">
              <Badge variant="outline" className="text-[10px] font-mono border-border/80">
                {queue.length} items in queue
              </Badge>
              <span className="text-foreground font-medium truncate max-w-sm">
                Active in Player: <strong>{activeVideo?.title || "None"}</strong>
              </span>
            </div>
            <Button
              size="sm"
              variant="link"
              onClick={() => setIsQueueCollapsed(false)}
              className="text-xs h-auto p-0 text-primary font-semibold gap-1"
            >
              <span>Expand Queue</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <CardContent className="p-4">
            {queueViewMode === "grid" ? (
              /* Grid View (Cards) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Dedicated Inline Drag & Drop Zone Tile */}
                <div
                  onClick={() => queueFileInputRef.current?.click()}
                  className={`p-3.5 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group min-h-[140px] select-none ${
                    isDraggingOverQueue
                      ? "border-primary bg-primary/10 scale-[1.01] shadow-xs"
                      : "border-border/80 hover:border-primary/80 bg-muted/15 hover:bg-muted/30"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 transition-all shadow-2xs">
                    <Upload className="w-4 h-4 text-primary group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-foreground block group-hover:text-primary transition-colors">
                      Drag & Drop Video Here
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      or click to browse (.mp4, .mov, .webm)
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono border-dashed border-primary/40 text-primary group-hover:border-primary">
                    + Add to Queue
                  </Badge>
                </div>

                {queue.map((item, idx) => {
                  const isSelected = item.id === (activeVideoId || activeVideo?.id);
                  const isUploading = item.status === "UPLOADING" || item.status === "PROCESSING";
                  const isQueued = item.status === "QUEUED";

                  return (
                    <div
                      key={item.id}
                      onClick={() => setActiveVideoId(item.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? "border-blue-500/80 bg-blue-500/5 shadow-xs ring-1 ring-blue-500/40"
                          : "border-border/70 bg-card hover:border-border hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            {item.platform === "TIKTOK" || item.platform === "YOUTUBE_SHORTS" ? (
                              <Smartphone className="w-4 h-4 text-primary" />
                            ) : (
                              <Monitor className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="font-bold text-xs text-foreground line-clamp-1">
                                {item.title}
                              </h5>
                              {isSelected && (
                                <Badge className="bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0 h-4">
                                  Reviewing
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {item.platform} • {item.aspectRatio} • {item.filename}
                            </p>
                          </div>
                        </div>

                        {isUploading ? (
                          <Badge className="bg-blue-600 text-white text-[9px] font-bold shrink-0 animate-pulse">
                            {item.progressPercent}%
                          </Badge>
                        ) : isQueued ? (
                          <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-600 font-mono shrink-0">
                            Queue #{idx + 1}
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white text-[9px] font-bold shrink-0">
                            Screened
                          </Badge>
                        )}
                      </div>

                      {/* Transfer / Progress Bar */}
                      {isUploading && (
                        <div className="space-y-1">
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 rounded-full"
                              style={{ width: `${item.progressPercent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="truncate max-w-[150px] font-medium text-foreground">
                              {item.currentStageLabel}
                            </span>
                            <span className="font-mono">{item.progressPercent}% buffered</span>
                          </div>
                        </div>
                      )}

                      {/* Action / Review Status */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                        {isUploading ? (
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-[10px]">
                            <Radio className="w-3 h-3 text-amber-500 animate-pulse" />
                            <span>Early review active so far</span>
                          </div>
                        ) : isQueued ? (
                          <span className="text-muted-foreground text-[10px]">
                            Waiting for upload slot
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Score: {item.complianceScore}/100 ({item.violationCount} flags)</span>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant={isSelected ? "secondary" : "ghost"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveVideoId(item.id);
                          }}
                          className="h-6 text-[10px] font-bold px-2"
                        >
                          {isSelected ? "Active in Player" : isUploading ? "Review Chunks" : "Inspect"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View (Rows) */
              <div className="space-y-2">
                {/* Inline Drag & Drop Zone Row */}
                <div
                  onClick={() => queueFileInputRef.current?.click()}
                  className={`p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-3 select-none ${
                    isDraggingOverQueue
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border/80 hover:border-primary/80 bg-muted/15 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Upload className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground">
                        Drag & Drop video files here or click to browse
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        MP4, MOV, WEBM • Up to 4K 60fps
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono border-dashed border-primary/40 text-primary">
                    + Add to Queue
                  </Badge>
                </div>

                {/* List Items */}
                {queue.map((item, idx) => {
                  const isSelected = item.id === (activeVideoId || activeVideo?.id);
                  const isUploading = item.status === "UPLOADING" || item.status === "PROCESSING";
                  const isQueued = item.status === "QUEUED";

                  return (
                    <div
                      key={item.id}
                      onClick={() => setActiveVideoId(item.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? "border-blue-500/80 bg-blue-500/5 shadow-xs ring-1 ring-blue-500/40"
                          : "border-border/70 bg-card hover:border-border hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {item.platform === "TIKTOK" || item.platform === "YOUTUBE_SHORTS" ? (
                            <Smartphone className="w-4 h-4 text-primary" />
                          ) : (
                            <Monitor className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-bold text-xs text-foreground truncate max-w-xs sm:max-w-md">
                              {item.title}
                            </h5>
                            {isSelected && (
                              <Badge className="bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0 h-4">
                                Reviewing
                              </Badge>
                            )}
                            {isUploading ? (
                              <Badge className="bg-blue-600 text-white text-[9px] font-bold shrink-0 animate-pulse">
                                {item.progressPercent}%
                              </Badge>
                            ) : isQueued ? (
                              <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-600 font-mono shrink-0">
                                Queue #{idx + 1}
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-600 text-white text-[9px] font-bold shrink-0">
                                Screened
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {item.platform} • {item.aspectRatio} • {item.filename}
                          </p>
                        </div>
                      </div>

                      {/* Right side stats & actions */}
                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                        {isUploading ? (
                          <div className="flex items-center gap-2 min-w-[150px]">
                            <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"
                                style={{ width: `${item.progressPercent}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">{item.progressPercent}%</span>
                          </div>
                        ) : isQueued ? (
                          <span className="text-[10px] text-muted-foreground font-mono">Waiting for slot</span>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Score: {item.complianceScore}/100</span>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant={isSelected ? "secondary" : "ghost"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveVideoId(item.id);
                          }}
                          className="h-7 text-xs font-semibold px-2.5"
                        >
                          {isSelected ? "Active in Player" : isUploading ? "Review Chunks" : "Inspect"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Target Platform & Aspect Ratio Selector Bar */}
      <Card className="border-border/80 shadow-xs bg-muted/30">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Target Platform:
            </span>
            <Button
              size="sm"
              variant={platform === "TIKTOK" ? "default" : "outline"}
              onClick={() => handlePlatformChange("TIKTOK")}
              className="text-xs gap-1.5 font-bold"
            >
              <Smartphone className="w-3.5 h-3.5" />
              TikTok (9:16)
            </Button>
            <Button
              size="sm"
              variant={platform === "YOUTUBE" ? "default" : "outline"}
              onClick={() => handlePlatformChange("YOUTUBE")}
              className="text-xs gap-1.5 font-bold"
            >
              <Monitor className="w-3.5 h-3.5" />
              YouTube (16:9)
            </Button>
            <Button
              size="sm"
              variant={platform === "YOUTUBE_SHORTS" ? "default" : "outline"}
              onClick={() => handlePlatformChange("YOUTUBE_SHORTS")}
              className="text-xs gap-1.5 font-bold"
            >
              <Film className="w-3.5 h-3.5" />
              YouTube Shorts (9:16)
            </Button>
            <Button
              size="sm"
              variant={platform === "LINKEDIN" ? "default" : "outline"}
              onClick={() => handlePlatformChange("LINKEDIN")}
              className="text-xs gap-1.5 font-bold"
            >
              LinkedIn Video
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Viewport:</span>
            <Button
              size="sm"
              variant={aspectRatio === "9:16" ? "secondary" : "ghost"}
              onClick={() => setAspectRatio("9:16")}
              className="text-xs h-7 px-2.5"
            >
              9:16 Vertical
            </Button>
            <Button
              size="sm"
              variant={aspectRatio === "16:9" ? "secondary" : "ghost"}
              onClick={() => setAspectRatio("16:9")}
              className="text-xs h-7 px-2.5"
            >
              16:9 Landscape
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Partial Upload Active Notification Banner */}
      {effectiveUploadPercent < 100 && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-200 shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <span>In-Progress Upload Stream Review Active</span>
                <Badge className="bg-amber-600 text-white text-[9px] font-bold">
                  {effectiveUploadPercent}% Buffered
                </Badge>
              </div>
              <p className="text-xs opacity-90 mt-0.5">
                Reviewing segments from <strong>0:00 to {formatTime(maxBufferedSec)}</strong> so far.
                Remaining segments are transferring in the background. You can playback, comment, and inspect flags right now.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPartialUploadMode(false);
              setPartialUploadPercent(100);
              toast.success("Switched to full asset view (100% available).");
            }}
            className="text-xs shrink-0 bg-background/80 hover:bg-background"
          >
            Clear Incomplete State
          </Button>
        </div>
      )}

      {/* Real-Time Background Job Status Tracker Card */}
      {activeJob && (
        <Card
          className={`border shadow-sm transition-all duration-300 ${
            activeJob.status === "PROCESSING"
              ? "border-blue-500/40 bg-blue-500/5 dark:bg-blue-950/20"
              : "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20"
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0 ${
                    activeJob.status === "PROCESSING" ? "bg-blue-600 animate-pulse" : "bg-emerald-600"
                  }`}
                >
                  {activeJob.status === "PROCESSING" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Video Being Uploaded:
                    </span>
                    <Badge
                      className={`text-[9px] uppercase font-bold ${
                        activeJob.status === "PROCESSING"
                          ? "bg-blue-600 text-white"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      {activeJob.status} ({activeJob.progress_percent}%)
                    </Badge>
                  </div>

                  {/* Dropdown of all videos being uploaded */}
                  <Select
                    value={activeVideoId || activeVideo?.id || (queue[0] ? queue[0].id : "")}
                    onValueChange={(val) => {
                      setActiveVideoId(val);
                      const selected = queue.find((q) => q.id === val);
                      if (selected) {
                        toast.info(`Switched active view to "${selected.title}"`);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[380px] md:w-[460px] h-8.5 text-xs font-bold bg-background border-border/80 shadow-xs">
                      <div className="flex items-center gap-2 truncate text-left">
                        <Video className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{activeVideo?.title || activeJob.filename}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {queue.map((item) => (
                        <SelectItem key={item.id} value={item.id} className="text-xs py-2">
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex items-center gap-2 truncate">
                              {item.platform === "TIKTOK" || item.platform === "YOUTUBE_SHORTS" ? (
                                <Smartphone className="w-3.5 h-3.5 text-primary shrink-0" />
                              ) : (
                                <Monitor className="w-3.5 h-3.5 text-primary shrink-0" />
                              )}
                              <span className="font-semibold truncate max-w-[240px]">{item.title}</span>
                            </div>
                            <Badge
                              className={`text-[9px] uppercase font-bold shrink-0 ${
                                item.status === "UPLOADING" || item.status === "PROCESSING"
                                  ? "bg-blue-600 text-white animate-pulse"
                                  : item.status === "QUEUED"
                                  ? "bg-amber-600 text-white"
                                  : "bg-emerald-600 text-white"
                              }`}
                            >
                              {item.status === "UPLOADING" || item.status === "PROCESSING"
                                ? `${item.progressPercent}%`
                                : item.status}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsJobExpanded(!isJobExpanded)}
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  {isJobExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {isJobExpanded ? "Hide Pipeline" : "View Pipeline Details"}
                </Button>
              </div>
            </div>

            {/* Animated Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden mt-3">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  activeJob.status === "PROCESSING"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                    : "bg-emerald-600"
                }`}
                style={{ width: `${activeJob.progress_percent}%` }}
              />
            </div>
          </CardHeader>

          {isJobExpanded && (
            <CardContent className="space-y-3 pt-1">
              {/* 5-Stage Visual Stepper */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
                {activeJob.stages.map((stg, idx) => (
                  <div
                    key={stg.id}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between space-y-1 transition-all ${
                      stg.status === "COMPLETED"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                        : stg.status === "IN_PROGRESS"
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/40"
                        : "bg-card border-border/60 text-muted-foreground opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold">Stage 0{idx + 1}</span>
                      {stg.status === "COMPLETED" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : stg.status === "IN_PROGRESS" ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />
                      )}
                    </div>
                    <span className="font-bold text-[11px] leading-tight line-clamp-2">
                      {stg.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Status & Buffer Summary Row (Replaces Terminal Log) */}
              <div className="p-3 rounded-lg bg-muted/20 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  <span className="font-bold text-foreground">Current Stage:</span>
                  <span className="text-muted-foreground">{activeJob.current_stage_label}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                  <span>Platform: <strong className="text-foreground">{platform}</strong></span>
                  <span>•</span>
                  <span>Buffered: <strong className="text-foreground">{activeJob.progress_percent}%</strong> (Reviewable to {formatTime(maxBufferedSec)})</span>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Top Banner Status */}
      {scanResult && (
        <div
          className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs ${
            scanResult.traffic_light === "RED"
              ? "bg-red-500/10 border-red-500/30 text-red-950 dark:text-red-200"
              : scanResult.traffic_light === "YELLOW"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-xs shrink-0 ${
                scanResult.traffic_light === "RED"
                  ? "bg-red-600"
                  : scanResult.traffic_light === "YELLOW"
                  ? "bg-amber-600"
                  : "bg-emerald-600"
              }`}
            >
              {scanResult.traffic_light === "RED" ? (
                <XCircle className="w-6 h-6" />
              ) : scanResult.traffic_light === "YELLOW" ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="font-bold text-base flex items-center gap-2">
                <span>
                  {scanResult.is_compliant
                    ? `Cleared for ${platform} Publication`
                    : `${scanResult.violations_count} Rule Violation(s) Flagged for ${platform}`}
                </span>
                <Badge
                  className={`text-[10px] uppercase font-bold ${
                    scanResult.traffic_light === "RED"
                      ? "bg-red-600 text-white"
                      : scanResult.traffic_light === "YELLOW"
                      ? "bg-amber-600 text-white"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  Risk: {scanResult.traffic_light}
                </Badge>
              </div>
              <p className="text-xs opacity-90 mt-0.5">
                Compliance Health Score: <strong>{scanResult.score} / 100</strong>. Defense
                non-endorsement disclaimer:{" "}
                <strong
                  className={
                    hasDoDDisclaimer
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {hasDoDDisclaimer ? "Verified Attached" : "Missing Disclaimer"}
                </strong>
                {" • "}
                <span>
                  <strong>{comments.length}</strong> Reviewer Note(s)
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const commentsSection =
                  comments.length > 0
                    ? `\n\nReviewer Comments & Sign-off Notes:\n` +
                      comments
                        .map((c) => {
                          const timeStr =
                            c.timestampSec !== null
                              ? c.endTimestampSec && c.endTimestampSec > c.timestampSec
                                ? ` @ ${formatTime(c.timestampSec)} - ${formatTime(c.endTimestampSec)}`
                                : ` @ ${formatTime(c.timestampSec)}`
                              : "";
                          return `- [${c.category}${timeStr}] ${c.author}: ${c.text}`;
                        })
                        .join("\n")
                    : "";

                const report = `ZenaTech Video Clearance Report\nPlatform: ${platform}\nAsset: ${videoTitle}\nScore: ${
                  scanResult.score
                }/100\nStatus: ${scanResult.traffic_light}\nViolations: ${
                  scanResult.violations_count
                }\nDoD Disclaimer: ${
                  hasDoDDisclaimer ? "Present" : "Missing"
                }\nBuffered Review: ${effectiveUploadPercent}% so far\n\nViolations Flagged:\n${scanResult.violations
                  .map(
                    (v) =>
                      `- [${v.severity}] ${v.rule_number} ${v.title}: ${v.explanation}`
                  )
                  .join("\n")}${commentsSection}`;

                navigator.clipboard.writeText(report);
                toast.success("Complete clearance report with reviewer notes copied!");
              }}
              className="text-xs gap-1.5 bg-background/80"
            >
              <Download className="w-3.5 h-3.5" />
              Copy Clearance Report
            </Button>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Video Player, Timeline Scrubber & Real-Time Comment Bar */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="overflow-hidden border-border/80 shadow-xs">
            {/* Video Viewport Container with Dynamic Aspect Ratio */}
            <div
              onDragEnter={handlePlayerDragEnter}
              onDragLeave={handlePlayerDragLeave}
              onDragOver={handlePlayerDragOver}
              onDrop={handlePlayerDrop}
              className={`relative bg-zinc-950 flex flex-col items-center justify-center text-white overflow-hidden group mx-auto transition-all duration-300 ${
                isDraggingOverPlayer ? "ring-2 ring-primary border-primary shadow-xl" : ""
              } ${
                aspectRatio === "9:16"
                  ? "w-[280px] sm:w-[320px] aspect-[9/16] rounded-2xl my-4 border-4 border-zinc-800 shadow-2xl"
                  : "w-full aspect-video"
              }`}
            >
              {/* Drag & Drop Player Overlay */}
              {isDraggingOverPlayer && (
                <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-xs border-2 border-dashed border-primary flex flex-col items-center justify-center p-6 text-center pointer-events-none animate-in fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-2 shadow-lg ring-4 ring-primary/20">
                    <Upload className="w-7 h-7 text-primary animate-bounce" />
                  </div>
                  <p className="text-sm font-bold text-white">Drop Video to Load in Player</p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                    Replaces current preview and adds to the upload review queue
                  </p>
                </div>
              )}

              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-cover"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-zinc-900 to-zinc-950">
                  <Film className="w-14 h-14 text-zinc-700 mb-3 animate-pulse" />
                  <div className="font-semibold text-zinc-300 text-sm mb-1">
                    {platform === "TIKTOK" || platform === "YOUTUBE_SHORTS"
                      ? "9:16 Vertical Reel Mode"
                      : "16:9 Widescreen Mode"}
                  </div>
                  <p className="text-xs text-zinc-500 max-w-xs">
                    Previewing {platform} format. Simulated defense telemetry active.
                  </p>
                  <div className="mt-4 px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-xs font-mono text-zinc-300 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                  </div>
                </div>
              )}

              {/* TikTok Safe Zone Guide Tag (When in 9:16) */}
              {aspectRatio === "9:16" && (
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 text-[10px] text-zinc-400 font-mono pointer-events-none">
                  {platform} Safe-Zone
                </div>
              )}

              {/* In-Video Active Subtitle Overlay */}
              {activeSegment && (
                <div className="absolute bottom-16 inset-x-3 flex justify-center pointer-events-none">
                  <div
                    className={`px-3 py-1.5 rounded-lg backdrop-blur-md text-xs font-medium text-center shadow-lg transition-all max-w-[90%] ${
                      activeSegment.risk === "RED"
                        ? "bg-red-950/90 text-red-200 border border-red-500/60"
                        : activeSegment.risk === "YELLOW"
                        ? "bg-amber-950/90 text-amber-200 border border-amber-500/60"
                        : "bg-black/80 text-zinc-100 border border-zinc-700/40"
                    }`}
                  >
                    {activeSegment.risk !== "GREEN" && (
                      <span className="inline-block mr-1.5 font-bold uppercase tracking-wide text-[9px] px-1 py-0.2 rounded bg-white/20">
                        {activeSegment.risk} Flag
                      </span>
                    )}
                    "{activeSegment.text}"
                  </div>
                </div>
              )}

              {/* Floating Controls Bar */}
              <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-wrap items-center justify-between gap-2 text-white text-xs">
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={togglePlay}
                    className="h-7 w-7 text-white hover:bg-white/20 transition-transform active:scale-95"
                    title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />}
                  </Button>

                  {/* Step Back 1s */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => stepTime(-1)}
                    className="h-7 w-7 text-white hover:bg-white/20"
                    title="Nudge back 1 second"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </Button>

                  {/* Step Forward 1s */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => stepTime(1)}
                    className="h-7 w-7 text-white hover:bg-white/20"
                    title="Nudge forward 1 second"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => seekTo(0)}
                    className="h-7 w-7 text-white hover:bg-white/20"
                    title="Reset to 0:00"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>

                  <span className="font-mono text-[11px] text-zinc-300 ml-1">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Playback Speed Pill Buttons */}
                  <div className="flex items-center bg-black/50 backdrop-blur-xs rounded-md p-0.5 border border-white/10 text-[10px]">
                    {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handlePlaybackRateChange(rate)}
                        className={`px-1.5 py-0.5 rounded transition-colors font-mono ${
                          playbackRate === rate
                            ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                            : "text-zinc-300 hover:text-white"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                      }
                      setIsMuted(!isMuted);
                    }}
                    className="h-7 w-7 text-white hover:bg-white/20"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Interactive Timeline Track with Buffered Progress Zone */}
            <div className="p-4 bg-card border-t border-border/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                <span className="text-muted-foreground flex items-center gap-1.5 font-semibold text-foreground">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Video Flag Timeline (Click marker or Play button to preview)
                  {effectiveUploadPercent < 100 && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40">
                      Buffered to {formatTime(maxBufferedSec)}
                    </Badge>
                  )}
                </span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                    Critical Red
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    Yellow
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Clean
                  </span>
                </div>
              </div>

              {/* Scrubber Track Row with Play/Pause Button, Step Controls, and Timestamps */}
              <div className="flex items-center gap-2 sm:gap-3 pt-1">
                {/* Play / Pause Button for Timeline */}
                <Button
                  type="button"
                  size="icon"
                  variant="default"
                  onClick={togglePlay}
                  className="h-8.5 w-8.5 rounded-full shadow-xs shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground transition-transform active:scale-95"
                  title={isPlaying ? "Pause video (Space)" : "Play video (Space)"}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5 fill-current" />
                  )}
                </Button>

                {/* Frame Step Back */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => stepTime(-1)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 hidden sm:inline-flex"
                  title="Step back 1 second"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </Button>

                {/* Frame Step Forward */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => stepTime(1)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 hidden sm:inline-flex"
                  title="Step forward 1 second"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </Button>

                {/* Current Playhead Timestamp */}
                <span className="font-mono text-xs font-bold text-foreground min-w-[36px] text-right shrink-0">
                  {formatTime(currentTime)}
                </span>

                {/* Scrubber Track with Buffered Chunk Range Visualizer */}
                <div className="relative flex-1 h-8 flex items-center select-none group">
                  {/* Visual Segments Track */}
                  <div className="absolute inset-x-0 h-3 rounded-full bg-muted/70 overflow-hidden flex shadow-inner">
                    {segments.map((seg) => {
                      const isWithinBuffered = seg.startSec <= maxBufferedSec;
                      const widthPercent = ((seg.endSec - seg.startSec) / duration) * 100;
                      return (
                        <div
                          key={seg.id}
                          onClick={() => seekTo(seg.startSec)}
                          style={{ width: `${widthPercent}%` }}
                          title={
                            isWithinBuffered
                              ? `${formatTime(seg.startSec)} - ${formatTime(seg.endSec)}: ${seg.text}`
                              : `[Chunk Uploading...] Available once buffered.`
                          }
                          className={`h-full cursor-pointer transition-opacity border-r border-background/20 ${
                            isWithinBuffered
                              ? seg.risk === "RED"
                                ? "bg-red-600 hover:opacity-85"
                                : seg.risk === "YELLOW"
                                ? "bg-amber-500 hover:opacity-85"
                                : "bg-emerald-500/70 hover:opacity-85"
                              : "bg-zinc-700/40 opacity-40 hover:opacity-60"
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Active Comment Range Highlight on Scrubber Track */}
                  {activeComment && activeComment.timestampSec !== null && activeComment.endTimestampSec && activeComment.endTimestampSec > activeComment.timestampSec && (
                    <div
                      style={{
                        left: `${(activeComment.timestampSec / duration) * 100}%`,
                        width: `${((activeComment.endTimestampSec - activeComment.timestampSec) / duration) * 100}%`,
                      }}
                      className="absolute inset-y-0 bg-blue-500/35 border-x-2 border-blue-500 rounded pointer-events-none z-15 shadow-xs animate-pulse"
                      title={`Active Range: ${formatTime(activeComment.timestampSec)} - ${formatTime(activeComment.endTimestampSec)}`}
                    />
                  )}

                  {/* Range Input Playhead */}
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.01}
                    value={currentTime}
                    onMouseDown={() => setIsDragging(true)}
                    onTouchStart={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onTouchEnd={() => setIsDragging(false)}
                    onChange={(e) => seekTo(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer z-20"
                  />

                  {/* Ultra-Smooth 60fps Playhead Glide Indicator */}
                  <div
                    style={{
                      left: `${(Math.min(currentTime, duration) / duration) * 100}%`,
                      transition: isDragging ? "none" : "left 60ms linear",
                      willChange: "left",
                    }}
                    className="absolute top-0 bottom-0 pointer-events-none transform -translate-x-1/2 flex items-center justify-center z-10"
                  >
                    <div className="w-2.5 h-6 bg-zinc-950 dark:bg-zinc-100 rounded-full shadow-lg ring-2 ring-primary flex items-center justify-center">
                      <div className="w-0.5 h-3 bg-zinc-500 dark:bg-zinc-400 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Total Duration */}
                <span className="font-mono text-xs text-muted-foreground min-w-[36px] shrink-0">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Quick Timestamped Comment Form Under Video */}
              <form
                onSubmit={handleAddComment}
                className="pt-2 border-t border-border/60 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Category Selector */}
                    <Select
                      value={commentCategory}
                      onValueChange={(val) => setCommentCategory(val as CommentCategory)}
                    >
                      <SelectTrigger className="w-[110px] h-7 text-xs font-bold">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LEGAL">Legal</SelectItem>
                        <SelectItem value="EDITORIAL">Editorial</SelectItem>
                        <SelectItem value="COMPLIANCE">Compliance</SelectItem>
                        <SelectItem value="NOTE">Note</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Mode Segmented Buttons: Point vs Range vs None */}
                    <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-muted/40">
                      <button
                        type="button"
                        onClick={() => setCommentTimeMode("POINT")}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                          commentTimeMode === "POINT"
                            ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>Point ({formatTime(currentTime)})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCommentTimeMode("RANGE");
                          const cur = Math.round(currentTime);
                          setRangeStartSec(cur);
                          setRangeEndSec(Math.min(duration, cur + 5));
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                          commentTimeMode === "RANGE"
                            ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Film className="w-2.5 h-2.5" />
                        <span>Range ({formatTime(rangeStartSec)} - {formatTime(rangeEndSec)})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCommentTimeMode("NONE")}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                          commentTimeMode === "NONE"
                            ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        No Time
                      </button>
                    </div>
                  </div>

                  {/* Range Adjustment Quick Buttons if in RANGE mode */}
                  {commentTimeMode === "RANGE" && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRangeStartSec(Math.round(currentTime))}
                        className="h-6 px-1.5 text-[10px] gap-1 font-semibold"
                        title="Set start time to current video playhead"
                      >
                        Set Start ({formatTime(currentTime)})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setRangeEndSec(Math.round(currentTime))}
                        className="h-6 px-1.5 text-[10px] gap-1 font-semibold"
                        title="Set end time to current video playhead"
                      >
                        Set End ({formatTime(currentTime)})
                      </Button>
                      <span className="text-zinc-400">|</span>
                      <button
                        type="button"
                        onClick={() => setRangeEndSec(Math.min(duration, rangeStartSec + 3))}
                        className="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted font-mono font-semibold"
                        title="Extend 3 seconds"
                      >
                        +3s
                      </button>
                      <button
                        type="button"
                        onClick={() => setRangeEndSec(Math.min(duration, rangeStartSec + 5))}
                        className="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted font-mono font-semibold"
                        title="Extend 5 seconds"
                      >
                        +5s
                      </button>
                      <button
                        type="button"
                        onClick={() => setRangeEndSec(Math.min(duration, rangeStartSec + 10))}
                        className="px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted font-mono font-semibold"
                        title="Extend 10 seconds"
                      >
                        +10s
                      </button>
                    </div>
                  )}
                </div>

                {/* Range inputs if in RANGE mode */}
                {commentTimeMode === "RANGE" && (
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-muted-foreground">From:</span>
                      <input
                        type="number"
                        min={0}
                        max={duration}
                        value={rangeStartSec}
                        onChange={(e) => setRangeStartSec(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-14 h-6 text-xs px-1.5 rounded border border-border bg-background font-mono text-center font-bold"
                      />
                      <span className="text-muted-foreground font-mono text-[10px]">({formatTime(rangeStartSec)})</span>

                      <span className="text-muted-foreground font-bold mx-1">→ To:</span>
                      <input
                        type="number"
                        min={0}
                        max={duration}
                        value={rangeEndSec}
                        onChange={(e) => setRangeEndSec(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-14 h-6 text-xs px-1.5 rounded border border-border bg-background font-mono text-center font-bold"
                      />
                      <span className="text-muted-foreground font-mono text-[10px]">({formatTime(rangeEndSec)})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary">
                        Duration: {Math.max(0, rangeEndSec - rangeStartSec)}s span
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => seekAndPause(rangeStartSec, "Range preview")}
                        className="h-6 text-[10px] px-2 font-bold text-primary hover:text-primary"
                      >
                        Preview Range
                      </Button>
                    </div>
                  </div>
                )}

                {/* Input row */}
                <div className="flex items-center gap-2">
                  <Input
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder={
                      commentTimeMode === "RANGE"
                        ? `Add note for range ${formatTime(rangeStartSec)} - ${formatTime(rangeEndSec)} (e.g. cut section or re-frame)`
                        : commentTimeMode === "POINT"
                        ? `Add reviewer note at ${formatTime(currentTime)}... (e.g. adjust disclaimer or cut)`
                        : "Add general reviewer note..."
                    }
                    className="h-8 text-xs flex-1"
                  />

                  <Button type="submit" size="sm" className="h-8 text-xs font-semibold px-3 gap-1.5 shrink-0">
                    <Send className="w-3 h-3" />
                    Post {commentTimeMode === "RANGE" ? "Range Note" : "Comment"}
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          {/* Video Dropzone & Upload Box */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                Upload Video Asset (.mp4 / .mov)
              </CardTitle>
              <CardDescription className="text-xs">
                Upload edited video cut for TikTok, YouTube, or Reels. Progressive streaming allows reviewing early chunks immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => document.getElementById("video-file-input")?.click()}
              >
                <input
                  id="video-file-input"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                  <Video className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-foreground">
                  {videoFile ? videoFile.name : "Click to select or drag & drop video cut"}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  MP4, MOV, WEBM (Early chunks stream for immediate review)
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="video-title" className="text-xs font-semibold">
                  Video Title (for YouTube / TikTok)
                </Label>
                <Input
                  id="video-title"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="e.g. ZenaDrone 1000 Demonstration"
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Platform Metadata, Reviewer Comments & Violations */}
        <div className="lg:col-span-5 space-y-6">
          {/* Platform Specific Metadata Screener */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" />
                  {platform === "YOUTUBE" ? "YouTube Description & Disclaimers" : "TikTok Caption & Hashtags"}
                </CardTitle>
                <Badge
                  variant={hasDoDDisclaimer ? "default" : "destructive"}
                  className="text-[10px]"
                >
                  {hasDoDDisclaimer ? "Disclaimer Verified" : "Disclaimer Missing"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {platform === "YOUTUBE"
                  ? "Defense visual content on YouTube requires mandatory non-endorsement disclaimers."
                  : "TikTok captions and hashtags are screened against prohibited claims and defense tags."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {platform === "YOUTUBE" ? (
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    value={youtubeDescription}
                    onChange={(e) => setYoutubeDescription(e.target.value)}
                    className="text-xs font-mono"
                    placeholder="Enter YouTube description..."
                  />
                  {!hasDoDDisclaimer && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setYoutubeDescription(
                          (prev) => prev.trim() + "\n\nDisclaimer: " + MANDATORY_DOD_DISCLAIMER
                        );
                        toast.success("Inserted mandatory DoD non-endorsement disclaimer!");
                      }}
                      className="text-xs w-full text-amber-600 dark:text-amber-400 border-amber-500/40"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1" />
                      Insert Mandatory DoD Disclaimer
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    value={tiktokCaption}
                    onChange={(e) => setTiktokCaption(e.target.value)}
                    className="text-xs font-mono"
                    placeholder="Enter TikTok caption and #hashtags..."
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Characters: {tiktokCaption.length} / 2200</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(tiktokCaption);
                        toast.success("TikTok caption copied!");
                      }}
                      className="text-[11px] h-6 px-2 gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copy Caption
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabbed Inspection: Violations, Reviewer Comments & Script */}
          <Tabs defaultValue="comments" className="w-full space-y-4">
            <TabsList className="w-full grid grid-cols-3 bg-muted/60 p-1 border border-border/60">
              <TabsTrigger value="comments" className="text-xs gap-1.5 font-semibold">
                <MessageSquare className="w-3.5 h-3.5" />
                Comments ({comments.length})
              </TabsTrigger>
              <TabsTrigger value="violations" className="text-xs gap-1.5 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                Flags ({scanResult?.violations_count || 0})
              </TabsTrigger>
              <TabsTrigger value="script" className="text-xs gap-1.5 font-semibold">
                <FileText className="w-3.5 h-3.5" />
                Script ({segments.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Reviewer Comments */}
            <TabsContent value="comments" className="space-y-3">
              <Card className="border-border/80 shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      Reviewer Notes & Feedback
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      {comments.length} Notes
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Pin notes to specific seconds on the timeline or add general clearance remarks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {comments.length > 0 ? (
                    comments.map((c) => {
                      const isCommentActive = activeCommentId === c.id;
                      const startSec = c.timestampSec;
                      const endSec = c.endTimestampSec;
                      const hasRange = startSec !== null && typeof endSec === "number" && endSec > startSec;

                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setActiveCommentId(c.id);
                            if (startSec !== null) {
                              seekAndPause(
                                startSec,
                                hasRange
                                  ? `${c.author} range (${formatTime(startSec)} - ${formatTime(endSec!)})`
                                  : `${c.author} note`
                              );
                            }
                          }}
                          className={`p-3 rounded-xl border text-xs space-y-2 shadow-2xs transition-all cursor-pointer ${
                            isCommentActive
                              ? "border-primary bg-primary/5 ring-2 ring-primary shadow-xs"
                              : "border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{c.author}</span>
                              <Badge
                                className={`text-[9px] uppercase font-bold py-0 ${
                                  c.category === "LEGAL"
                                    ? "bg-purple-600 text-white"
                                    : c.category === "EDITORIAL"
                                    ? "bg-blue-600 text-white"
                                    : c.category === "COMPLIANCE"
                                    ? "bg-amber-600 text-white"
                                    : "bg-zinc-600 text-white"
                                }`}
                              >
                                {c.category}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {startSec !== null && (
                                <Button
                                  size="sm"
                                  variant={isCommentActive ? "default" : "outline"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCommentId(c.id);
                                    seekAndPause(
                                      startSec,
                                      hasRange
                                        ? `${c.author} range (${formatTime(startSec)} - ${formatTime(endSec!)})`
                                        : `${c.author} note`
                                    );
                                  }}
                                  className={`h-5.5 px-2 text-[10px] font-mono gap-1 font-bold ${
                                    isCommentActive
                                      ? "bg-primary text-primary-foreground shadow-xs"
                                      : "text-primary hover:bg-primary/10 border-primary/30"
                                  }`}
                                  title="Click to jump to this moment and pause video"
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>
                                    {hasRange
                                      ? `${formatTime(startSec)} - ${formatTime(endSec!)}`
                                      : formatTime(startSec)}
                                  </span>
                                  {hasRange && (
                                    <span className="text-[8px] opacity-85 ml-0.5 font-sans">
                                      ({endSec! - startSec}s)
                                    </span>
                                  )}
                                  <Pause className="w-2.5 h-2.5 ml-0.5" />
                                </Button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteComment(c.id);
                                }}
                                className="text-muted-foreground hover:text-red-500 p-1"
                                title="Delete note"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <p className="text-foreground/95 leading-relaxed pl-1 font-medium">{c.text}</p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pl-1 pt-0.5">
                            <span>{c.createdAt}</span>
                            <span className="text-primary font-semibold text-[9px] flex items-center gap-1 opacity-85">
                              <Pause className="w-2.5 h-2.5" />
                              {startSec !== null
                                ? hasRange
                                  ? `Range: ${formatTime(startSec)} - ${formatTime(endSec!)} (${endSec! - startSec}s span)`
                                  : `Click to jump & pause at ${formatTime(startSec)}`
                                : "General remark"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No reviewer notes yet. Use the bar under the video player to add feedback!
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: Flags & Violations */}
            <TabsContent value="violations" className="space-y-3">
              <Card className="border-border/80 shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-primary" />
                    Violations Flagged & Compliant Fixes ({scanResult?.violations_count || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {scanResult && scanResult.violations.length > 0 ? (
                    scanResult.violations.map((v, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setSelectedViolation(v);
                          const matchingSeg = segments.find((s) =>
                            v.flagged_terms.some((term) =>
                              s.text.toLowerCase().includes(term.toLowerCase())
                            )
                          );
                          if (matchingSeg) {
                            seekAndPause(matchingSeg.startSec, `Violation: ${v.rule_number}`);
                          }
                        }}
                        className={`p-3.5 rounded-lg border text-xs space-y-2 cursor-pointer transition-all ${
                          selectedViolation?.rule_number === v.rule_number
                            ? "ring-2 ring-primary shadow-xs"
                            : ""
                        } ${
                          v.traffic_light === "RED"
                            ? "border-red-500/40 bg-red-500/5 hover:border-red-500"
                            : "border-amber-500/40 bg-amber-500/5 hover:border-amber-500"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {v.rule_number}
                            </Badge>
                            {v.title}
                          </span>
                          <Badge
                            className={`text-[9px] uppercase font-bold ${
                              v.traffic_light === "RED"
                                ? "bg-red-600 text-white"
                                : "bg-amber-600 text-white"
                            }`}
                          >
                            {v.severity}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            Trigger Words:
                          </span>
                          {v.flagged_terms.map((term, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 font-mono text-[10px] font-bold"
                            >
                              "{term}"
                            </span>
                          ))}
                        </div>

                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          {v.explanation}
                        </p>

                        {v.remediation_guidance && (
                          <div className="p-2 rounded bg-card border border-border/80 text-[11px] text-foreground space-y-1">
                            <strong className="text-primary flex items-center gap-1 text-[11px]">
                              <Zap className="w-3 h-3 text-amber-500" /> Compliant Fix:
                            </strong>
                            <p>{v.remediation_guidance}</p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      No compliance flags found. Ready for publication.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: Synchronized Transcript with Buffered Availability Badges */}
            <TabsContent value="script" className="space-y-3">
              <Card className="border-border/80 shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Voiceover & Script Sync ({segments.length} Segments)
                    </CardTitle>
                    {effectiveUploadPercent < 100 && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
                        {segments.filter((s) => s.startSec <= maxBufferedSec).length} / {segments.length} Segments Buffered
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    Click any buffered line to seek video playhead.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {segments.map((seg) => {
                    const isBuffered = seg.startSec <= maxBufferedSec;
                    const isActive = currentTime >= seg.startSec && currentTime <= seg.endSec;
                    return (
                      <div
                        key={seg.id}
                        onClick={() => isBuffered && seekAndPause(seg.startSec, `Voiceover segment`)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                          !isBuffered
                            ? "border-dashed border-border/50 bg-muted/20 opacity-50 hover:opacity-75"
                            : isActive
                            ? "ring-2 ring-primary border-primary bg-primary/5"
                            : seg.risk === "RED"
                            ? "border-red-500/40 bg-red-500/5 hover:border-red-500/70"
                            : seg.risk === "YELLOW"
                            ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70"
                            : "border-border/70 bg-card hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3 text-primary" />
                            {formatTime(seg.startSec)} - {formatTime(seg.endSec)}
                          </span>

                          <div className="flex items-center gap-1">
                            {!isBuffered ? (
                              <Badge variant="secondary" className="text-[9px] gap-1">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Chunk Transferring
                              </Badge>
                            ) : (
                              <>
                                {seg.risk === "RED" && (
                                  <Badge className="bg-red-600 text-white text-[9px] uppercase font-bold py-0">
                                    Red Flag
                                  </Badge>
                                )}
                                {seg.risk === "YELLOW" && (
                                  <Badge className="bg-amber-600 text-white text-[9px] uppercase font-bold py-0">
                                    Yellow Flag
                                  </Badge>
                                )}
                                {seg.risk === "GREEN" && (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                                    <Check className="w-3 h-3" /> Clean
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <p className="text-foreground/90 leading-relaxed font-sans">{seg.text}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
