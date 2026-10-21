import { useEffect, useState } from "react";

export interface VideoThumbnail {
  /** JPEG data URL of the most representative frame, or null if none could be read. */
  dataUrl: string | null;
  /** Video length in seconds. */
  duration: number | null;
}

// Fractions of the video to sample. Early frames are often black fades or title cards.
const SAMPLE_POINTS = [0.12, 0.25, 0.4, 0.55, 0.7, 0.85];
const cache = new Map<string, Promise<VideoThumbnail>>();

function waitFor(video: HTMLVideoElement, event: string, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`timed out waiting for ${event}`));
    }, timeoutMs);
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("video failed to load"));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(event, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

/** Mean brightness and contrast of a small sample: higher contrast means more visible detail. */
function scoreFrame(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const { data } = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  let sumSq = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += lum;
    sumSq += lum * lum;
  }
  const mean = sum / pixels;
  const stdDev = Math.sqrt(Math.max(0, sumSq / pixels - mean * mean));
  // Penalise near-black and blown-out frames so a busy-but-dark frame doesn't win.
  const exposure = mean < 30 || mean > 230 ? 0.25 : 1;
  return stdDev * exposure;
}

async function extract(url: string): Promise<VideoThumbnail> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await waitFor(video, "loadeddata", 8000);
  } catch {
    return { dataUrl: null, duration: Number.isFinite(video.duration) ? video.duration : null };
  }
  const duration = Number.isFinite(video.duration) ? video.duration : null;
  if (!video.videoWidth || !video.videoHeight) return { dataUrl: null, duration };

  // Score at low resolution; capture the winner at a card-friendly size.
  const probe = document.createElement("canvas");
  probe.width = 64;
  probe.height = Math.max(1, Math.round((64 * video.videoHeight) / video.videoWidth));
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });
  const out = document.createElement("canvas");
  out.width = Math.min(640, video.videoWidth);
  out.height = Math.round((out.width * video.videoHeight) / video.videoWidth);
  const outCtx = out.getContext("2d");
  if (!probeCtx || !outCtx) return { dataUrl: null, duration };

  const times = duration ? SAMPLE_POINTS.map((f) => f * duration) : [0.5];
  let bestScore = -1;
  let best: string | null = null;
  for (const t of times) {
    try {
      video.currentTime = t;
      await waitFor(video, "seeked");
      probeCtx.drawImage(video, 0, 0, probe.width, probe.height);
      const score = scoreFrame(probeCtx, probe.width, probe.height);
      if (score > bestScore) {
        bestScore = score;
        outCtx.drawImage(video, 0, 0, out.width, out.height);
        best = out.toDataURL("image/jpeg", 0.82);
      }
    } catch {
      // Skip frames that can't be seeked or read (e.g. an incomplete file).
    }
  }
  video.removeAttribute("src");
  video.load();
  return { dataUrl: best, duration };
}

/** Pick (and cache) the most representative frame of a video URL. */
export function getVideoThumbnail(url: string): Promise<VideoThumbnail> {
  let pending = cache.get(url);
  if (!pending) {
    pending = extract(url).catch(() => ({ dataUrl: null, duration: null }));
    cache.set(url, pending);
  }
  return pending;
}

export function useVideoThumbnail(url?: string | null): VideoThumbnail {
  const [result, setResult] = useState<VideoThumbnail>({ dataUrl: null, duration: null });
  useEffect(() => {
    if (!url) return;
    let active = true;
    getVideoThumbnail(url).then((r) => active && setResult(r));
    return () => {
      active = false;
    };
  }, [url]);
  return url ? result : { dataUrl: null, duration: null };
}
