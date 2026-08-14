'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  type VideoEditTimeline,
  effectiveTrackGain,
  isTimeKept,
  nextKeptTime,
  objectContainRect,
  zoomAtTime,
} from '~/lib/videos/edit-timeline';

export type TimelinePlaybackPlayerHandle = {
  seekToSourceMs: (ms: number) => void;
};

type Props = {
  masterUrl: string;
  timeline: VideoEditTimeline;
  /** Optional separate mic AAC; when set, master video is muted and mic/system mix via Web Audio. */
  micUrl?: string | null;
  systemUrl?: string | null;
  className?: string;
  autoPlay?: boolean;
  playerRef?: React.Ref<TimelinePlaybackPlayerHandle>;
};

/**
 * Public / editor-style playback: skips deleted ranges, applies zooms + click ripples,
 * mixes mic/system gains when sidecars are present.
 */
export function TimelinePlaybackPlayer(props: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const micRef = useRef<HTMLAudioElement>(null);
  const systemRef = useRef<HTMLAudioElement>(null);
  const seekingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const systemGainRef = useRef<GainNode | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameBox, setFrameBox] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  const hasDualAudio = Boolean(props.micUrl || props.systemUrl);
  const timeline = props.timeline;

  useImperativeHandle(
    props.playerRef,
    () => ({
      seekToSourceMs: (ms: number) => {
        const video = videoRef.current;
        if (!video) return;
        const clamped = Math.max(0, ms);
        seekingRef.current = true;
        video.currentTime = clamped / 1000;
        setPlayheadMs(clamped);
        if (micRef.current) micRef.current.currentTime = clamped / 1000;
        if (systemRef.current) systemRef.current.currentTime = clamped / 1000;
        void video.play().catch(() => undefined);
      },
    }),
    [],
  );

  const updateFrameBox = useCallback(() => {
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!stage || !video) return;
    const mediaW = video.videoWidth || 16;
    const mediaH = video.videoHeight || 9;
    setFrameBox(
      objectContainRect(stage.clientWidth, stage.clientHeight, mediaW, mediaH),
    );
  }, []);

  useEffect(() => {
    updateFrameBox();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateFrameBox());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [updateFrameBox, props.masterUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncSecondary = (t: number) => {
      if (micRef.current && Math.abs(micRef.current.currentTime - t) > 0.12) {
        micRef.current.currentTime = t;
      }
      if (
        systemRef.current &&
        Math.abs(systemRef.current.currentTime - t) > 0.12
      ) {
        systemRef.current.currentTime = t;
      }
    };

    const skipDeleted = () => {
      if (seekingRef.current) return;
      const ms = video.currentTime * 1000;
      setPlayheadMs(ms);
      syncSecondary(video.currentTime);
      if (video.paused) return;
      if (isTimeKept(timeline.keepRanges, ms)) return;
      const next = nextKeptTime(timeline.keepRanges, ms + 1);
      if (next == null) {
        video.pause();
        micRef.current?.pause();
        systemRef.current?.pause();
        return;
      }
      seekingRef.current = true;
      video.currentTime = next / 1000;
      syncSecondary(next / 1000);
    };

    const onSeeked = () => {
      seekingRef.current = false;
      setPlayheadMs(video.currentTime * 1000);
      syncSecondary(video.currentTime);
    };

    const onPlay = async () => {
      setIsPlaying(true);
      const ms = video.currentTime * 1000;
      if (!isTimeKept(timeline.keepRanges, ms)) {
        const next = nextKeptTime(timeline.keepRanges, ms);
        if (next == null) {
          video.pause();
          return;
        }
        seekingRef.current = true;
        video.currentTime = next / 1000;
      }
      try {
        await audioCtxRef.current?.resume();
      } catch {
        /* ignore */
      }
      void micRef.current?.play().catch(() => undefined);
      void systemRef.current?.play().catch(() => undefined);
    };

    const onPause = () => {
      setIsPlaying(false);
      micRef.current?.pause();
      systemRef.current?.pause();
    };

    video.addEventListener('timeupdate', skipDeleted);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', skipDeleted);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [timeline.keepRanges]);

  useEffect(() => {
    if (!hasDualAudio) return;
    const video = videoRef.current;
    if (!video) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    video.muted = true;

    if (props.micUrl && micRef.current) {
      const src = ctx.createMediaElementSource(micRef.current);
      const gain = ctx.createGain();
      gain.gain.value = effectiveTrackGain(timeline.audio.mic);
      src.connect(gain).connect(ctx.destination);
      micGainRef.current = gain;
    }
    if (props.systemUrl && systemRef.current) {
      const src = ctx.createMediaElementSource(systemRef.current);
      const gain = ctx.createGain();
      gain.gain.value = effectiveTrackGain(timeline.audio.system);
      src.connect(gain).connect(ctx.destination);
      systemGainRef.current = gain;
    }

    return () => {
      void ctx.close();
      audioCtxRef.current = null;
      micGainRef.current = null;
      systemGainRef.current = null;
      video.muted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init only when URLs change
  }, [hasDualAudio, props.micUrl, props.systemUrl]);

  useEffect(() => {
    if (micGainRef.current) {
      micGainRef.current.gain.value = effectiveTrackGain(timeline.audio.mic);
    }
    if (systemGainRef.current) {
      systemGainRef.current.gain.value = effectiveTrackGain(
        timeline.audio.system,
      );
    }
  }, [timeline.audio]);

  const activeZoom = zoomAtTime(timeline.zooms, playheadMs);
  const activeClicks = timeline.clickStyle.enabled
    ? timeline.clicks.filter((c) => {
        const age = playheadMs - c.tMs;
        return age >= 0 && age <= timeline.clickStyle.fadeMs;
      })
    : [];

  return (
    <div
      ref={stageRef}
      className={
        props.className ?? 'relative h-full w-full overflow-hidden bg-black'
      }
    >
      <div
        className="absolute overflow-hidden"
        style={{
          left: frameBox.left,
          top: frameBox.top,
          width: frameBox.width || '100%',
          height: frameBox.height || '100%',
          transform: activeZoom ? `scale(${activeZoom.scale})` : undefined,
          transformOrigin: activeZoom
            ? `${activeZoom.cx * 100}% ${activeZoom.cy * 100}%`
            : undefined,
        }}
      >
        <video
          ref={videoRef}
          src={props.masterUrl}
          className="h-full w-full object-fill"
          controls={false}
          playsInline
          crossOrigin="anonymous"
          autoPlay={props.autoPlay}
          onLoadedMetadata={() => {
            setReady(true);
            updateFrameBox();
          }}
          onLoadedData={() => setReady(true)}
        />
        {activeClicks.map((c) => {
          const age = playheadMs - c.tMs;
          const t = age / timeline.clickStyle.fadeMs;
          return (
            <span
              key={`${c.tMs}-${c.x}-${c.y}`}
              className="pointer-events-none absolute rounded-full border-2"
              style={{
                left: `${c.x * 100}%`,
                top: `${c.y * 100}%`,
                width: timeline.clickStyle.radiusPx * (0.6 + t * 1.4) * 2,
                height: timeline.clickStyle.radiusPx * (0.6 + t * 1.4) * 2,
                transform: 'translate(-50%, -50%)',
                borderColor: timeline.clickStyle.color,
                opacity: 1 - t,
              }}
            />
          );
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent p-3">
        <button
          type="button"
          className="rounded-md bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.paused) void video.play();
            else video.pause();
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(1, timeline.sourceDurationMs)}
          value={playheadMs}
          className="h-1.5 flex-1 accent-[var(--ozer-accent,#FF5C34)]"
          onChange={(e) => {
            const ms = Number(e.target.value);
            setPlayheadMs(ms);
            const video = videoRef.current;
            if (video) video.currentTime = ms / 1000;
          }}
        />
      </div>
      {props.micUrl ? (
        <audio
          ref={micRef}
          src={props.micUrl}
          preload="auto"
          crossOrigin="anonymous"
          className="hidden"
        />
      ) : null}
      {props.systemUrl ? (
        <audio
          ref={systemRef}
          src={props.systemUrl}
          preload="auto"
          crossOrigin="anonymous"
          className="hidden"
        />
      ) : null}
      {!ready ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/70">
          Loading…
        </div>
      ) : null}
    </div>
  );
}
