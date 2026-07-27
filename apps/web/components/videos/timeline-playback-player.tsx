'use client';

import { useEffect, useRef, useState } from 'react';

import {
  type VideoEditTimeline,
  effectiveTrackGain,
  isTimeKept,
  nextKeptTime,
  zoomAtTime,
} from '~/lib/videos/edit-timeline';

type Props = {
  masterUrl: string;
  timeline: VideoEditTimeline;
  /** Optional separate mic AAC; when set, master video is muted and mic/system mix via Web Audio. */
  micUrl?: string | null;
  systemUrl?: string | null;
  className?: string;
  autoPlay?: boolean;
};

/**
 * Public / editor-style playback: skips deleted ranges, applies zooms + click ripples,
 * mixes mic/system gains when sidecars are present.
 */
export function TimelinePlaybackPlayer(props: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const micRef = useRef<HTMLAudioElement>(null);
  const systemRef = useRef<HTMLAudioElement>(null);
  const seekingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const systemGainRef = useRef<GainNode | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [ready, setReady] = useState(false);

  const hasDualAudio = Boolean(props.micUrl || props.systemUrl);
  const timeline = props.timeline;

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

    const dest = ctx.destination;

    if (props.micUrl && micRef.current) {
      const src = ctx.createMediaElementSource(micRef.current);
      const gain = ctx.createGain();
      gain.gain.value = effectiveTrackGain(timeline.audio.mic);
      src.connect(gain).connect(dest);
      micGainRef.current = gain;
    }

    if (props.systemUrl && systemRef.current) {
      const src = ctx.createMediaElementSource(systemRef.current);
      const gain = ctx.createGain();
      gain.gain.value = effectiveTrackGain(timeline.audio.system);
      src.connect(gain).connect(dest);
      systemGainRef.current = gain;
    }

    // If only one sidecar, also route master audio as the other? No — sidecars are authoritative.
    // When dual missing one side, unmute video for the embedded track as fallback:
    if (!props.micUrl && !props.systemUrl) {
      video.muted = false;
    } else if (!props.micUrl || !props.systemUrl) {
      // Keep video muted; missing sidecar simply silent for that stem.
    }

    setReady(true);
    return () => {
      void ctx.close().catch(() => undefined);
      audioCtxRef.current = null;
      micGainRef.current = null;
      systemGainRef.current = null;
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
    <div className={props.className ?? 'relative h-full w-full bg-black'}>
      <video
        ref={videoRef}
        src={props.masterUrl}
        className="h-full w-full object-contain"
        controls
        playsInline
        crossOrigin="anonymous"
        autoPlay={props.autoPlay}
        style={
          activeZoom
            ? {
                transform: `scale(${activeZoom.scale})`,
                transformOrigin: `${activeZoom.cx * 100}% ${activeZoom.cy * 100}%`,
              }
            : undefined
        }
        onLoadedData={() => setReady(true)}
      />
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
      {!ready ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/70">
          Loading…
        </div>
      ) : null}
    </div>
  );
}
