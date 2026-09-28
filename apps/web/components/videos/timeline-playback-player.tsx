'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  Captions,
  CaptionsOff,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { type CaptionCue, captionCueAt } from '~/lib/videos/captions';
import {
  type VideoEditTimeline,
  editedDurationMs,
  editedMsToSourceMs,
  effectiveTrackGain,
  isTimeKept,
  nextKeptTime,
  objectContainRect,
  sourceMsToEditedMsClamped,
  zoomAtTime,
} from '~/lib/videos/edit-timeline';
import type { VideoPlayerConfigValues } from '~/lib/videos/player-config-types';

export type TimelinePlaybackPlayerHandle = {
  seekToSourceMs: (ms: number) => void;
};

export type TimelinePlayerControlsConfig = Pick<
  VideoPlayerConfigValues,
  | 'autoplay'
  | 'muted'
  | 'loop'
  | 'default_playback_speed'
  | 'allowed_speeds'
  | 'show_controls'
  | 'show_play_button'
  | 'show_progress_bar'
  | 'show_volume_control'
  | 'show_speed_control'
  | 'show_fullscreen_button'
  | 'show_captions_button'
  | 'enable_captions'
  | 'primary_color'
>;

type Props = {
  masterUrl: string;
  timeline: VideoEditTimeline;
  /** Optional separate mic AAC; when set, master video is muted and mic/system mix via Web Audio. */
  micUrl?: string | null;
  systemUrl?: string | null;
  className?: string;
  autoPlay?: boolean;
  controls?: TimelinePlayerControlsConfig;
  /** Caption cues in source (original recording) time. */
  captions?: CaptionCue[];
  playerRef?: React.Ref<TimelinePlaybackPlayerHandle>;
  /** The browser can't decode the master (e.g. HEVC in Firefox). */
  onUnsupported?: () => void;
};

const CONTROLS_IDLE_HIDE_MS = 2500;

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type IosVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

/**
 * Public / editor-style playback: skips deleted ranges, applies zooms + click ripples,
 * mixes mic/system gains when sidecars are present. The progress bar and clock use
 * edited (post-trim) time so cut sections never appear on the timeline.
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
  const masterGainRef = useRef<GainNode | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const suppressTapRef = useRef(false);

  const controls = props.controls;
  const allowedSpeeds = [...(controls?.allowed_speeds ?? [1])]
    .filter((s) => s > 0)
    .sort((a, b) => a - b);
  const loop = Boolean(controls?.loop);

  const [playheadMs, setPlayheadMs] = useState(0);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(Boolean(controls?.muted));
  const [speed, setSpeed] = useState(controls?.default_playback_speed ?? 1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(
    Boolean(controls?.enable_captions),
  );
  const [frameBox, setFrameBox] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  const hasDualAudio = Boolean(props.micUrl || props.systemUrl);
  const timeline = props.timeline;
  const keepRanges = timeline.keepRanges;
  const firstKeptMs = keepRanges[0]?.startMs ?? 0;
  const lastKeptMs = keepRanges[keepRanges.length - 1]?.endMs ?? 0;
  const editedTotalMs =
    keepRanges.length > 0
      ? editedDurationMs(keepRanges)
      : timeline.sourceDurationMs;
  const editedNowMs =
    keepRanges.length > 0
      ? sourceMsToEditedMsClamped(keepRanges, playheadMs)
      : playheadMs;

  const showControlBar = controls ? controls.show_controls : true;
  const showPlay = !controls || controls.show_play_button;
  const showProgress = !controls || controls.show_progress_bar;
  const showVolume = Boolean(controls?.show_volume_control);
  const showSpeed =
    Boolean(controls?.show_speed_control) && allowedSpeeds.length > 1;
  const showFullscreen = !controls || controls.show_fullscreen_button;
  const captionCues = props.captions ?? [];
  const hasCaptions = captionCues.length > 0;
  const showCaptionsButton =
    hasCaptions && Boolean(controls?.show_captions_button);
  const accentColor = controls?.primary_color || 'var(--ozer-accent, #FF5C34)';

  const seekSource = useCallback((sourceMs: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, sourceMs);
    seekingRef.current = true;
    video.currentTime = clamped / 1000;
    setPlayheadMs(clamped);
    if (micRef.current) micRef.current.currentTime = clamped / 1000;
    if (systemRef.current) systemRef.current.currentTime = clamped / 1000;
  }, []);

  useImperativeHandle(
    props.playerRef,
    () => ({
      seekToSourceMs: (ms: number) => {
        seekSource(ms);
        void videoRef.current?.play().catch(() => undefined);
      },
    }),
    [seekSource],
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

    const finishOrLoop = () => {
      if (loop && keepRanges.length > 0) {
        seekingRef.current = true;
        video.currentTime = firstKeptMs / 1000;
        syncSecondary(firstKeptMs / 1000);
        void video.play().catch(() => undefined);
        return;
      }
      video.pause();
      micRef.current?.pause();
      systemRef.current?.pause();
      setPlayheadMs(lastKeptMs || video.currentTime * 1000);
    };

    const skipDeleted = () => {
      if (seekingRef.current) return;
      const ms = video.currentTime * 1000;
      setPlayheadMs(ms);
      syncSecondary(video.currentTime);
      if (video.paused) return;
      if (isTimeKept(keepRanges, ms)) return;
      const next = nextKeptTime(keepRanges, ms + 1);
      if (next == null) {
        finishOrLoop();
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
      if (keepRanges.length > 0 && !isTimeKept(keepRanges, ms)) {
        const target = (nextKeptTime(keepRanges, ms) ?? firstKeptMs) / 1000;
        seekingRef.current = true;
        video.currentTime = target;
        if (micRef.current) micRef.current.currentTime = target;
        if (systemRef.current) systemRef.current.currentTime = target;
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

    const onEnded = () => finishOrLoop();

    video.addEventListener('timeupdate', skipDeleted);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', skipDeleted);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [keepRanges, loop, firstKeptMs, lastKeptMs]);

  useEffect(() => {
    if (!hasDualAudio) return;
    const video = videoRef.current;
    if (!video) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    video.muted = true;

    const master = ctx.createGain();
    master.connect(ctx.destination);
    masterGainRef.current = master;

    if (props.micUrl && micRef.current) {
      const src = ctx.createMediaElementSource(micRef.current);
      const gain = ctx.createGain();
      gain.gain.value = effectiveTrackGain(timeline.audio.mic);
      src.connect(gain).connect(master);
      micGainRef.current = gain;
    }
    if (props.systemUrl && systemRef.current) {
      const src = ctx.createMediaElementSource(systemRef.current);
      const gain = ctx.createGain();
      gain.gain.value = effectiveTrackGain(timeline.audio.system);
      src.connect(gain).connect(master);
      systemGainRef.current = gain;
    }

    return () => {
      void ctx.close();
      audioCtxRef.current = null;
      micGainRef.current = null;
      systemGainRef.current = null;
      masterGainRef.current = null;
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

  useEffect(() => {
    const level = muted ? 0 : volume;
    if (hasDualAudio) {
      if (masterGainRef.current) masterGainRef.current.gain.value = level;
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted, hasDualAudio]);

  const applySpeed = useCallback((rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    if (micRef.current) micRef.current.playbackRate = rate;
    if (systemRef.current) systemRef.current.playbackRate = rate;
  }, []);

  useEffect(() => {
    applySpeed(speed);
  }, [speed, applySpeed]);

  useEffect(() => {
    const doc = document as FullscreenDocument;
    const onChange = () => {
      const element = doc.fullscreenElement ?? doc.webkitFullscreenElement;
      setIsFullscreen(Boolean(element && element === stageRef.current));
    };
    const video = videoRef.current;
    const onIosBegin = () => setIsFullscreen(true);
    const onIosEnd = () => setIsFullscreen(false);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    video?.addEventListener('webkitbeginfullscreen', onIosBegin);
    video?.addEventListener('webkitendfullscreen', onIosEnd);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      video?.removeEventListener('webkitbeginfullscreen', onIosBegin);
      video?.removeEventListener('webkitendfullscreen', onIosEnd);
    };
  }, []);

  useEffect(() => {
    if (!speedMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!speedMenuRef.current?.contains(event.target as Node)) {
        setSpeedMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [speedMenuOpen]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, CONTROLS_IDLE_HIDE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as FullscreenDocument;
    const stage = stageRef.current as FullscreenElement | null;
    const video = videoRef.current as IosVideoElement | null;
    if (!stage) return;

    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      void (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    if (stage.requestFullscreen) {
      void stage.requestFullscreen().catch(() => undefined);
    } else if (stage.webkitRequestFullscreen) {
      void stage.webkitRequestFullscreen();
    } else {
      video?.webkitEnterFullscreen?.();
    }
  }, []);

  const activeZoom = zoomAtTime(timeline.zooms, playheadMs);
  const activeClicks = timeline.clickStyle.enabled
    ? timeline.clicks.filter((c) => {
        const age = playheadMs - c.tMs;
        return age >= 0 && age <= timeline.clickStyle.fadeMs;
      })
    : [];

  const barVisible = !isPlaying || controlsVisible || speedMenuOpen;
  const activeCue =
    captionsOn && hasCaptions ? captionCueAt(captionCues, playheadMs) : null;
  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={stageRef}
      className={cn(
        'relative h-full w-full overflow-hidden bg-black',
        !barVisible && 'cursor-none',
        props.className,
      )}
      onPointerMove={revealControls}
      onPointerDown={(event) => {
        suppressTapRef.current = event.pointerType === 'touch' && !barVisible;
        revealControls();
      }}
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
          autoPlay={props.autoPlay ?? controls?.autoplay}
          onError={(event) => {
            const code = event.currentTarget.error?.code;
            if (
              code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ||
              code === MediaError.MEDIA_ERR_DECODE
            ) {
              props.onUnsupported?.();
            }
          }}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            // Some browsers load an undecodable video track as audio-only.
            if (video.videoWidth === 0 && video.videoHeight === 0) {
              props.onUnsupported?.();
              return;
            }
            setReady(true);
            updateFrameBox();
            applySpeed(speed);
            if (
              keepRanges.length > 0 &&
              !isTimeKept(keepRanges, video.currentTime * 1000)
            ) {
              seekSource(firstKeptMs);
            }
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

      <button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="absolute inset-0 z-[5] cursor-[inherit]"
        onClick={() => {
          if (suppressTapRef.current) {
            suppressTapRef.current = false;
            return;
          }
          togglePlay();
        }}
        onDoubleClick={showFullscreen ? toggleFullscreen : undefined}
      />

      {ready && !isPlaying ? (
        <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg sm:h-20 sm:w-20"
            style={{ backgroundColor: accentColor }}
          >
            <Play className="ml-1 h-7 w-7 fill-current sm:h-9 sm:w-9" />
          </span>
        </div>
      ) : null}

      {activeCue ? (
        <div
          aria-live="off"
          className={cn(
            'pointer-events-none absolute inset-x-0 z-[7] flex justify-center px-4 transition-[bottom] duration-200',
            showControlBar && barVisible
              ? 'bottom-16 sm:bottom-20'
              : 'bottom-4 sm:bottom-8',
          )}
        >
          <p
            className="max-w-[90%] rounded-md bg-black/75 px-3 py-1 text-center leading-snug text-white"
            style={{ fontSize: 'clamp(0.875rem, 2.2vw, 1.75rem)' }}
          >
            {activeCue.text}
          </p>
        </div>
      ) : null}

      {showControlBar ? (
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pt-8 pb-3 text-white transition-opacity duration-200 sm:gap-3',
            barVisible
              ? 'opacity-100'
              : 'pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100',
          )}
        >
          {showPlay ? (
            <button
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              )}
            </button>
          ) : null}

          <span className="shrink-0 text-xs text-white/90 tabular-nums sm:text-sm">
            {formatClock(editedNowMs)}
            <span className="text-white/50"> / </span>
            {formatClock(editedTotalMs)}
          </span>

          {showProgress ? (
            <input
              type="range"
              aria-label="Seek"
              min={0}
              max={Math.max(1, editedTotalMs)}
              step={100}
              value={Math.min(editedNowMs, editedTotalMs)}
              className="h-1.5 min-w-0 flex-1 cursor-pointer"
              style={{ accentColor }}
              onChange={(e) => {
                const editedMs = Number(e.target.value);
                const sourceMs =
                  keepRanges.length > 0
                    ? (editedMsToSourceMs(keepRanges, editedMs) ?? editedMs)
                    : editedMs;
                seekSource(sourceMs);
              }}
            />
          ) : (
            <span className="flex-1" />
          )}

          {showVolume ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
                onClick={() => setMuted((m) => !m)}
              >
                <VolumeIcon className="h-5 w-5" />
              </button>
              <input
                type="range"
                aria-label="Volume"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                className="hidden h-1.5 w-16 cursor-pointer sm:block md:w-20"
                style={{ accentColor }}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setVolume(next);
                  setMuted(next === 0);
                }}
              />
            </div>
          ) : null}

          {showCaptionsButton ? (
            <button
              type="button"
              aria-label={captionsOn ? 'Hide captions' : 'Show captions'}
              aria-pressed={captionsOn}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
              onClick={() => setCaptionsOn((on) => !on)}
            >
              {captionsOn ? (
                <Captions className="h-5 w-5" style={{ color: accentColor }} />
              ) : (
                <CaptionsOff className="h-5 w-5" />
              )}
            </button>
          ) : null}

          {showSpeed ? (
            <div
              ref={speedMenuRef}
              className="relative shrink-0"
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSpeedMenuOpen(false);
              }}
            >
              <button
                type="button"
                aria-label={`Playback speed ${speed}×`}
                aria-expanded={speedMenuOpen}
                className="flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums hover:bg-white/15 sm:text-sm"
                onClick={() => setSpeedMenuOpen((open) => !open)}
              >
                {speed}×
              </button>
              {speedMenuOpen ? (
                <div
                  role="group"
                  aria-label="Playback speed"
                  className="absolute right-0 bottom-full mb-2 min-w-[5rem] overflow-hidden rounded-lg bg-black/90 py-1 shadow-lg ring-1 ring-white/10"
                >
                  {allowedSpeeds.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={option === speed}
                      className={cn(
                        'block w-full px-3 py-1.5 text-left text-sm tabular-nums hover:bg-white/15',
                        option === speed && 'font-semibold',
                      )}
                      style={
                        option === speed ? { color: accentColor } : undefined
                      }
                      onClick={() => {
                        setSpeed(option);
                        setSpeedMenuOpen(false);
                      }}
                    >
                      {option}×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {showFullscreen ? (
            <button
              type="button"
              aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
          ) : null}
        </div>
      ) : null}

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
