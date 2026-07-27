/**
 * Client-side bake: play the master through keep-ranges on a canvas with
 * zoom + click ripples, capture via MediaRecorder, return a Blob for TUS upload.
 */
import {
  type VideoClickEvent,
  type VideoEditTimeline,
  editedDurationMs,
  isTimeKept,
  zoomAtTime,
} from '~/lib/videos/edit-timeline';

export type BakeProgress = {
  phase: 'loading' | 'recording' | 'done' | 'error';
  progress: number;
  message?: string;
};

function nextKeptTime(
  timeline: VideoEditTimeline,
  fromMs: number,
): number | null {
  for (const r of timeline.keepRanges) {
    if (r.endMs <= fromMs) continue;
    if (fromMs < r.startMs) return r.startMs;
    if (fromMs < r.endMs) return fromMs;
  }
  return null;
}

function drawClickRipples(
  ctx: CanvasRenderingContext2D,
  clicks: VideoClickEvent[],
  style: VideoEditTimeline['clickStyle'],
  sourceMs: number,
  width: number,
  height: number,
) {
  if (!style.enabled) return;
  for (const click of clicks) {
    const age = sourceMs - click.tMs;
    if (age < 0 || age > style.fadeMs) continue;
    const t = age / style.fadeMs;
    const radius = style.radiusPx * (0.6 + t * 1.4);
    const alpha = 1 - t;
    ctx.beginPath();
    ctx.arc(click.x * width, click.y * height, radius, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(style.color, alpha * 0.9);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(
      click.x * width,
      click.y * height,
      Math.max(2, radius * 0.25),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = hexToRgba(style.color, alpha * 0.55);
    ctx.fill();
  }
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export async function bakeEditedVideo(input: {
  masterUrl: string;
  timeline: VideoEditTimeline;
  onProgress?: (p: BakeProgress) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const { masterUrl, timeline, onProgress, signal } = input;
  onProgress?.({
    phase: 'loading',
    progress: 0.02,
    message: 'Loading master…',
  });

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = false;
  video.src = masterUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('Could not load master video'));
    signal?.addEventListener('abort', () => reject(new Error('Aborted')));
  });

  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const stream = canvas.captureStream(30);
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaElementSource(video);
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);
  // Do not connect to audioCtx.destination — avoids loud preview during bake.
  for (const track of dest.stream.getAudioTracks()) {
    stream.addTrack(track);
  }

  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 6_000_000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const totalEdited = Math.max(1, editedDurationMs(timeline.keepRanges));
  onProgress?.({ phase: 'recording', progress: 0.05, message: 'Rendering…' });

  recorder.start(250);

  const startKept = nextKeptTime(timeline, 0);
  if (startKept == null) {
    recorder.stop();
    throw new Error('Nothing left to publish — all ranges were deleted.');
  }

  video.currentTime = startKept / 1000;
  await waitSeek(video);
  await video.play();

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort);

    let raf = 0;
    const tick = () => {
      const sourceMs = video.currentTime * 1000;

      if (!isTimeKept(timeline.keepRanges, sourceMs)) {
        const next = nextKeptTime(timeline, sourceMs + 1);
        if (next == null) {
          cleanup();
          resolve();
          return;
        }
        video.currentTime = next / 1000;
        waitSeek(video).then(() => {
          void video.play();
          raf = requestAnimationFrame(tick);
        });
        return;
      }

      const zoom = zoomAtTime(timeline.zooms, sourceMs);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      if (zoom && zoom.scale > 1.01) {
        const sw = width / zoom.scale;
        const sh = height / zoom.scale;
        const sx = Math.min(width - sw, Math.max(0, zoom.cx * width - sw / 2));
        const sy = Math.min(
          height - sh,
          Math.max(0, zoom.cy * height - sh / 2),
        );
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
      } else {
        ctx.drawImage(video, 0, 0, width, height);
      }

      drawClickRipples(
        ctx,
        timeline.clicks,
        timeline.clickStyle,
        sourceMs,
        width,
        height,
      );

      let editedPos = 0;
      for (const r of timeline.keepRanges) {
        if (sourceMs < r.startMs) break;
        if (sourceMs <= r.endMs) {
          editedPos += sourceMs - r.startMs;
          break;
        }
        editedPos += r.endMs - r.startMs;
      }
      onProgress?.({
        phase: 'recording',
        progress: Math.min(0.95, 0.05 + (editedPos / totalEdited) * 0.9),
        message: 'Rendering…',
      });

      if (video.ended || sourceMs >= timeline.sourceDurationMs - 30) {
        const next = nextKeptTime(timeline, sourceMs + 1);
        if (next == null) {
          cleanup();
          resolve();
          return;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    function cleanup() {
      cancelAnimationFrame(raf);
      signal?.removeEventListener('abort', onAbort);
      video.pause();
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }

    raf = requestAnimationFrame(tick);
    video.onended = () => {
      cleanup();
      resolve();
    };
  });

  await new Promise<void>((r) => {
    if (recorder.state === 'inactive') {
      r();
      return;
    }
    recorder.onstop = () => r();
  });

  try {
    await audioCtx.close();
  } catch {
    /* ignore */
  }

  onProgress?.({ phase: 'done', progress: 1, message: 'Done' });
  return new Blob(chunks, { type: mime });
}

function waitSeek(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
  });
}
