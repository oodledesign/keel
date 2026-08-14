'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import Link from 'next/link';

import {
  ArrowLeft,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  Undo2,
  ZoomIn,
} from 'lucide-react';
import * as tus from 'tus-js-client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { bakeEditedVideo } from '~/lib/videos/bake-edited-video.client';
import {
  type VideoEditTimeline,
  type VideoKeepRange,
  type VideoTranscriptWord,
  type VideoZoomKeyframe,
  deletedGaps,
  editedDurationMs,
  effectiveTrackGain,
  isTimeKept,
  nextKeptTime,
  normalizeTimeline,
  objectContainRect,
  removeRangeFromKeep,
  restoreRangeToKeep,
  suggestZoomsFromClicks,
  zoomAtTime,
} from '~/lib/videos/edit-timeline';
import { workspacePanelCard } from '~/lib/workspace-ui';

import { TimelineWaveform } from './timeline-waveform';

type Props = {
  accountSlug: string;
  videoId: string;
  videoTitle: string;
  hasMaster: boolean;
  initialTimeline: VideoEditTimeline;
  initialRevision: number;
  publishedRevision: number;
  initialTranscript: {
    plainText: string;
    words: VideoTranscriptWord[];
  } | null;
  initialHasChapters: boolean;
  initialHasSummary: boolean;
};

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

export function VideoEditorClient(props: Props) {
  const videoHref = pathsConfig.app.accountVideoDetail
    ? pathsConfig.app.accountVideoDetail
        .replace('[account]', props.accountSlug)
        .replace('[videoId]', props.videoId)
    : `/home/${props.accountSlug}/videos/${props.videoId}`;

  const [timeline, setTimeline] = useState(() =>
    normalizeTimeline(props.initialTimeline),
  );
  const [revision, setRevision] = useState(props.initialRevision);
  const [publishedRevision, setPublishedRevision] = useState(
    props.publishedRevision,
  );
  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [micUrl, setMicUrl] = useState<string | null>(null);
  const [systemUrl, setSystemUrl] = useState<string | null>(null);
  const [hasDualAudio, setHasDualAudio] = useState(false);
  const [selection, setSelection] = useState<{
    startMs: number;
    endMs: number;
  } | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [transcript, setTranscript] = useState(props.initialTranscript);
  const [selectedWordIndexes, setSelectedWordIndexes] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<string | null>(null);
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const [selectedGap, setSelectedGap] = useState<VideoKeepRange | null>(null);
  const [undoStack, setUndoStack] = useState<VideoKeepRange[][]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameBox, setFrameBox] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const [hasChapters, setHasChapters] = useState(props.initialHasChapters);
  const [hasSummary, setHasSummary] = useState(props.initialHasSummary);
  const [generatingChapters, setGeneratingChapters] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [confirmChaptersOpen, setConfirmChaptersOpen] = useState(false);
  const [confirmSummaryOpen, setConfirmSummaryOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const micAudioRef = useRef<HTMLAudioElement>(null);
  const systemAudioRef = useRef<HTMLAudioElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ startMs: number } | null>(null);
  const seekingRef = useRef(false);
  const previewAudioCtxRef = useRef<AudioContext | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const systemGainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!hasDualAudio || !masterUrl) return;
    const video = videoRef.current;
    if (!video) return;

    const ctx = new AudioContext();
    previewAudioCtxRef.current = ctx;
    video.muted = true;

    if (micUrl && micAudioRef.current) {
      const src = ctx.createMediaElementSource(micAudioRef.current);
      const gain = ctx.createGain();
      gain.gain.value = effectiveTrackGain(timeline.audio.mic);
      src.connect(gain).connect(ctx.destination);
      micGainNodeRef.current = gain;
    }
    if (systemUrl && systemAudioRef.current) {
      const src = ctx.createMediaElementSource(systemAudioRef.current);
      const gain = ctx.createGain();
      gain.gain.value = effectiveTrackGain(timeline.audio.system);
      src.connect(gain).connect(ctx.destination);
      systemGainNodeRef.current = gain;
    }

    const sync = () => {
      const t = video.currentTime;
      if (
        micAudioRef.current &&
        Math.abs(micAudioRef.current.currentTime - t) > 0.15
      ) {
        micAudioRef.current.currentTime = t;
      }
      if (
        systemAudioRef.current &&
        Math.abs(systemAudioRef.current.currentTime - t) > 0.15
      ) {
        systemAudioRef.current.currentTime = t;
      }
    };
    const onPlay = () => {
      void ctx.resume();
      void micAudioRef.current?.play().catch(() => undefined);
      void systemAudioRef.current?.play().catch(() => undefined);
    };
    const onPause = () => {
      micAudioRef.current?.pause();
      systemAudioRef.current?.pause();
    };
    video.addEventListener('timeupdate', sync);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', sync);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.muted = false;
      void ctx.close().catch(() => undefined);
      previewAudioCtxRef.current = null;
      micGainNodeRef.current = null;
      systemGainNodeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnect when URLs change
  }, [hasDualAudio, masterUrl, micUrl, systemUrl]);

  useEffect(() => {
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = effectiveTrackGain(
        timeline.audio.mic,
      );
    }
    if (systemGainNodeRef.current) {
      systemGainNodeRef.current.gain.value = effectiveTrackGain(
        timeline.audio.system,
      );
    } else if (videoRef.current && !hasDualAudio) {
      videoRef.current.volume = Math.min(
        1,
        effectiveTrackGain(timeline.audio.mic),
      );
      videoRef.current.muted = timeline.audio.mic.muted;
    }
  }, [timeline.audio, hasDualAudio]);

  const dirty = revision !== publishedRevision;
  const editedLen = editedDurationMs(timeline.keepRanges);
  const gaps = useMemo(
    () => deletedGaps(timeline.keepRanges, timeline.sourceDurationMs),
    [timeline.keepRanges, timeline.sourceDurationMs],
  );

  useEffect(() => {
    if (!props.hasMaster) return;
    void fetch(`/api/videos/${props.videoId}/master`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.url) setMasterUrl(j.url as string);
        setMicUrl((j.micUrl as string | null) ?? null);
        setSystemUrl((j.systemUrl as string | null) ?? null);
        setHasDualAudio(Boolean(j.micUrl || j.systemUrl));
      })
      .catch(() => toast.error('Could not load master preview'));
  }, [props.hasMaster, props.videoId]);

  const saveTimeline = useCallback(
    (next: VideoEditTimeline) => {
      setTimeline(next);
      startTransition(async () => {
        try {
          const res = await fetch(`/api/videos/${props.videoId}/edit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeline: next }),
          });
          const json = await res.json();
          if (!json.ok) throw new Error(json.error?.message ?? 'Save failed');
          setRevision(json.revision as number);
          setTimeline(normalizeTimeline(json.timeline));
        } catch (err) {
          toast.error(getErrorMessage(err));
        }
      });
    },
    [props.videoId],
  );

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    const from = Math.min(selection.startMs, selection.endMs);
    const to = Math.max(selection.startMs, selection.endMs);
    if (to - from < 40) return;
    const keepRanges = removeRangeFromKeep(timeline.keepRanges, from, to);
    if (keepRanges.length === 0) {
      toast.error('Cannot delete the entire video');
      return;
    }
    setUndoStack((stack) => [...stack.slice(-19), timeline.keepRanges]);
    setSelection(null);
    setSelectedGap(null);
    saveTimeline({ ...timeline, keepRanges });
    toast.success(
      'Removed selection — select a grey gap, then Backspace to restore',
    );
  }, [selection, timeline, saveTimeline]);

  const restoreSelectedGap = useCallback(() => {
    if (!selectedGap) return;
    setUndoStack((stack) => [...stack.slice(-19), timeline.keepRanges]);
    const keepRanges = restoreRangeToKeep(
      timeline.keepRanges,
      selectedGap.startMs,
      selectedGap.endMs,
    );
    setSelectedGap(null);
    saveTimeline({ ...timeline, keepRanges });
    toast.success('Restored deleted segment');
  }, [selectedGap, timeline, saveTimeline]);

  const undoKeepRanges = useCallback(() => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack((stack) => stack.slice(0, -1));
    saveTimeline({ ...timeline, keepRanges: previous });
    toast.success('Undid cut');
  }, [undoStack, timeline, saveTimeline]);

  const skipDeletedDuringPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || seekingRef.current) return;
    const ms = video.currentTime * 1000;
    setPlayheadMs(ms);
    if (video.paused) return;
    if (isTimeKept(timeline.keepRanges, ms)) return;

    const next = nextKeptTime(timeline.keepRanges, ms + 1);
    if (next == null) {
      video.pause();
      return;
    }
    seekingRef.current = true;
    video.currentTime = next / 1000;
  }, [timeline.keepRanges]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onSeeked = () => {
      seekingRef.current = false;
      setPlayheadMs(video.currentTime * 1000);
    };
    const onPlay = () => {
      setIsPlaying(true);
      const ms = video.currentTime * 1000;
      if (isTimeKept(timeline.keepRanges, ms)) return;
      const next = nextKeptTime(timeline.keepRanges, ms);
      if (next == null) {
        video.pause();
        return;
      }
      seekingRef.current = true;
      video.currentTime = next / 1000;
    };
    const onPause = () => setIsPlaying(false);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [timeline.keepRanges, masterUrl]);

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
  }, [updateFrameBox, masterUrl]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const editable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (editable) return;
        if (undoStack.length === 0) return;
        e.preventDefault();
        undoKeepRanges();
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        if (editable) return;
        e.preventDefault();
        togglePlayback();
        return;
      }

      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (editable) return;
      if (selection) {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (selectedGap) {
        e.preventDefault();
        restoreSelectedGap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selection,
    selectedGap,
    deleteSelection,
    restoreSelectedGap,
    undoStack,
    undoKeepRanges,
    togglePlayback,
  ]);

  const activeZoom = useMemo(
    () => zoomAtTime(timeline.zooms, playheadMs),
    [timeline.zooms, playheadMs],
  );

  const activeClicks = useMemo(() => {
    if (!timeline.clickStyle.enabled) return [];
    return timeline.clicks.filter((c) => {
      const age = playheadMs - c.tMs;
      return age >= 0 && age <= timeline.clickStyle.fadeMs;
    });
  }, [timeline.clicks, timeline.clickStyle, playheadMs]);

  function onTimelinePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left) / rect.width),
    );
    const ms = Math.round(ratio * timeline.sourceDurationMs);
    draggingRef.current = { startMs: ms };
    setSelectedGap(null);
    setSelection({ startMs: ms, endMs: ms });
    setPlayheadMs(ms);
    if (videoRef.current) videoRef.current.currentTime = ms / 1000;
  }

  function onTimelinePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left) / rect.width),
    );
    const ms = Math.round(ratio * timeline.sourceDurationMs);
    setSelection({ startMs: draggingRef.current.startMs, endMs: ms });
    setPlayheadMs(ms);
  }

  function onTimelinePointerUp() {
    draggingRef.current = null;
  }

  async function handleSuggestZooms() {
    const zooms = suggestZoomsFromClicks(
      timeline.clicks,
      timeline.sourceDurationMs,
      timeline.keepRanges,
    );
    saveTimeline({ ...timeline, zooms });
    toast.success(
      zooms.length
        ? `Suggested ${zooms.length} zoom${zooms.length === 1 ? '' : 's'}`
        : 'No click clusters found for zooms',
    );
  }

  async function handleTranscribe() {
    startTransition(async () => {
      try {
        toast.message('Transcribing…');
        const res = await fetch(
          `/api/videos/${props.videoId}/edit/transcript`,
          { method: 'POST' },
        );
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? 'Transcription failed');
        setTranscript({
          plainText: json.transcript.plainText,
          words: json.transcript.words,
        });
        toast.success('Transcript ready');
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    });
  }

  function cutSelectedWords() {
    if (!transcript || selectedWordIndexes.length === 0) return;
    const words = selectedWordIndexes
      .map((i) => transcript.words[i])
      .filter(Boolean) as VideoTranscriptWord[];
    const from = Math.min(...words.map((w) => w.startMs));
    const to = Math.max(...words.map((w) => w.endMs));
    const keepRanges = removeRangeFromKeep(timeline.keepRanges, from, to);
    if (keepRanges.length === 0) {
      toast.error('Cannot delete the entire video');
      return;
    }
    setUndoStack((stack) => [...stack.slice(-19), timeline.keepRanges]);
    setSelectedWordIndexes([]);
    saveTimeline({ ...timeline, keepRanges });
    toast.success('Removed transcript selection from video');
  }

  async function runGenerateChapters() {
    setGeneratingChapters(true);
    try {
      const res = await fetch(
        `/api/videos/${props.videoId}/chapters/generate`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Failed to generate chapters');
      }
      setHasChapters(true);
      toast.success('Chapters generated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setGeneratingChapters(false);
    }
  }

  async function runGenerateSummary() {
    setGeneratingSummary(true);
    try {
      const res = await fetch(`/api/videos/${props.videoId}/summary/generate`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Failed to generate summary');
      }
      setHasSummary(true);
      toast.success('Summary generated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function handlePublish() {
    if (!masterUrl) {
      toast.error('Master not available');
      return;
    }
    setPublishing(true);
    setPublishProgress('Publishing…');
    try {
      const publishRes = await fetch(
        `/api/videos/${props.videoId}/edit/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeline }),
        },
      );
      const publishJson = await publishRes.json();
      if (!publishJson.ok) {
        throw new Error(publishJson.error ?? 'Publish failed');
      }
      const latest = normalizeTimeline(publishJson.timeline);
      setRevision(publishJson.revision);
      setPublishedRevision(publishJson.publishedRevision);
      setTimeline(latest);
      toast.success('Live on public link — optimizing embed in background…');
      setPublishing(false);
      setPublishProgress(null);

      // Background Bunny bake for embeds / CDN (does not block the watch URL).
      void (async () => {
        try {
          const startRes = await fetch(
            `/api/videos/${props.videoId}/edit/republish`,
            { method: 'POST' },
          );
          const startJson = await startRes.json();
          if (!startJson.ok) return;

          const blob = await bakeEditedVideo({
            masterUrl,
            micUrl,
            systemUrl,
            timeline: latest,
          });

          const file = new File([blob], 'edited.webm', { type: blob.type });
          await uploadBlobToBunny(file, {
            bunnyVideoId: startJson.bunnyVideoId,
            libraryId: startJson.libraryId,
            signature: startJson.signature,
            expiry: startJson.expiry,
            tusEndpoint: startJson.tusEndpoint,
            title: props.videoTitle,
          });

          await fetch(`/api/videos/${props.videoId}/edit/republish/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobId: startJson.jobId,
              bunnyVideoId: startJson.bunnyVideoId,
              durationSeconds: Math.round(
                editedDurationMs(latest.keepRanges) / 1000,
              ),
            }),
          });
          toast.message('Embed optimized');
        } catch {
          toast.message(
            'Public link is live; embed optimization can retry later',
          );
        }
      })();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setPublishing(false);
      setPublishProgress(null);
    }
  }

  function updateZoom(patch: Partial<VideoZoomKeyframe> & { id: string }) {
    const zooms = timeline.zooms.map((z) =>
      z.id === patch.id ? { ...z, ...patch } : z,
    );
    saveTimeline({ ...timeline, zooms });
  }

  const selectedZoom = timeline.zooms.find((z) => z.id === selectedZoomId);

  if (!props.hasMaster) {
    return (
      <div className={cn(workspacePanelCard, 'space-y-4 p-8')}>
        <p className="text-[var(--workspace-shell-text)]">
          This video does not have an editable master yet. The desktop recorder
          uploaded the published file, but not a re-editable master copy.
        </p>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          You can create one from the published Bunny video (good for cuts /
          zooms). Click ripples need a new recording from an updated Mac app.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => {
              startTransition(async () => {
                try {
                  toast.message('Importing master from published video…');
                  const res = await fetch(
                    `/api/videos/${props.videoId}/master/import-from-stream`,
                    { method: 'POST' },
                  );
                  const json = await res.json();
                  if (!json.ok) {
                    throw new Error(json.error ?? 'Import failed');
                  }
                  toast.success('Master ready — reloading editor');
                  window.location.reload();
                } catch (err) {
                  toast.error(getErrorMessage(err));
                }
              });
            }}
            disabled={isPending}
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              'Use published video as master'
            )}
          </Button>
          <Link
            href={videoHref}
            className="inline-flex h-9 items-center text-sm text-[var(--ozer-accent)]"
          >
            Back to player
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={videoHref}
          className="inline-flex items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Player settings
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="text-xs text-[var(--workspace-shell-text-muted)]">
              Unpublished edits
            </span>
          ) : (
            <span className="text-xs text-[var(--ozer-accent)]">
              Published up to date
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (hasChapters) {
                setConfirmChaptersOpen(true);
                return;
              }
              void runGenerateChapters();
            }}
            disabled={
              !transcript ||
              generatingChapters ||
              generatingSummary ||
              publishing
            }
          >
            {generatingChapters ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            {hasChapters ? 'Refresh chapters' : 'Generate chapters'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (hasSummary) {
                setConfirmSummaryOpen(true);
                return;
              }
              void runGenerateSummary();
            }}
            disabled={
              !transcript ||
              generatingChapters ||
              generatingSummary ||
              publishing
            }
          >
            {generatingSummary ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            {hasSummary ? 'Refresh summary' : 'Generate summary'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleSuggestZooms()}
            disabled={isPending || publishing}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Suggest zooms
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handlePublish()}
            disabled={publishing || !masterUrl}
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          >
            {publishing ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                {publishProgress ?? 'Publishing…'}
              </>
            ) : (
              'Publish to link'
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={cn(workspacePanelCard, 'overflow-hidden p-3')}>
          <div
            ref={stageRef}
            className="relative aspect-video overflow-hidden rounded-xl bg-black"
          >
            {masterUrl ? (
              <div
                className="absolute overflow-hidden"
                style={{
                  left: frameBox.left,
                  top: frameBox.top,
                  width: frameBox.width || '100%',
                  height: frameBox.height || '100%',
                  transform: activeZoom
                    ? `scale(${activeZoom.scale})`
                    : undefined,
                  transformOrigin: activeZoom
                    ? `${activeZoom.cx * 100}% ${activeZoom.cy * 100}%`
                    : undefined,
                }}
              >
                <video
                  ref={videoRef}
                  src={masterUrl}
                  className="h-full w-full object-fill"
                  controls={false}
                  playsInline
                  onLoadedMetadata={updateFrameBox}
                  onTimeUpdate={skipDeletedDuringPlayback}
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
                        width:
                          timeline.clickStyle.radiusPx * (0.6 + t * 1.4) * 2,
                        height:
                          timeline.clickStyle.radiusPx * (0.6 + t * 1.4) * 2,
                        transform: 'translate(-50%, -50%)',
                        borderColor: timeline.clickStyle.color,
                        opacity: 1 - t,
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text-muted)]">
                Loading master…
              </div>
            )}
            {micUrl ? (
              <audio
                ref={micAudioRef}
                src={micUrl}
                preload="auto"
                crossOrigin="anonymous"
                className="hidden"
              />
            ) : null}
            {systemUrl ? (
              <audio
                ref={systemAudioRef}
                src={systemUrl}
                preload="auto"
                crossOrigin="anonymous"
                className="hidden"
              />
            ) : null}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={togglePlayback}
              disabled={!masterUrl}
            >
              {isPlaying ? (
                <>
                  <Pause className="mr-1.5 h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-4 w-4" />
                  Play
                </>
              )}
            </Button>
            <span className="text-xs text-[var(--workspace-shell-text-muted)]">
              {formatMs(playheadMs)} / {formatMs(timeline.sourceDurationMs)} ·
              Space to play/pause
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--workspace-shell-text-muted)]">
              <span>
                Source {formatMs(timeline.sourceDurationMs)} · Edited{' '}
                {formatMs(editedLen)}
              </span>
              <span>
                {selection
                  ? `Selection ${formatMs(Math.abs(selection.endMs - selection.startMs))} — Backspace to cut`
                  : selectedGap
                    ? `Cut selected (${formatMs(selectedGap.endMs - selectedGap.startMs)}) — Backspace to restore`
                    : gaps.length
                      ? 'Drag to select · click a grey gap to select it'
                      : 'Drag on the timeline to select a range'}
              </span>
            </div>

            <div
              className="relative h-20 cursor-crosshair overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]"
              onPointerDown={onTimelinePointerDown}
              onPointerMove={onTimelinePointerMove}
              onPointerUp={onTimelinePointerUp}
              onPointerLeave={onTimelinePointerUp}
            >
              <TimelineWaveform
                masterUrl={masterUrl}
                sourceDurationMs={timeline.sourceDurationMs}
                keepRanges={timeline.keepRanges}
              />
              {/* Deleted gaps (selectable; Backspace restores) */}
              {gaps.map((g) => {
                const isSelected =
                  selectedGap?.startMs === g.startMs &&
                  selectedGap?.endMs === g.endMs;
                return (
                  <button
                    key={`gap-${g.startMs}-${g.endMs}`}
                    type="button"
                    title={`Select cut ${formatMs(g.endMs - g.startMs)} — Backspace to restore`}
                    className={cn(
                      'absolute top-1 bottom-1 z-[1] rounded-md bg-[color:var(--workspace-shell-text-muted)]/20 hover:bg-[color:var(--workspace-shell-text-muted)]/35',
                      isSelected &&
                        'ring-2 ring-[var(--ozer-accent)] ring-offset-1 ring-offset-[var(--workspace-control-surface)]',
                    )}
                    style={{
                      left: `${(g.startMs / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                      width: `${((g.endMs - g.startMs) / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelection(null);
                      setSelectedGap(g);
                      setPlayheadMs(g.startMs);
                      if (videoRef.current) {
                        videoRef.current.currentTime = g.startMs / 1000;
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                );
              })}
              {/* Kept segments */}
              {timeline.keepRanges.map((r) => (
                <div
                  key={`${r.startMs}-${r.endMs}`}
                  className="pointer-events-none absolute top-1 bottom-1 z-[1] rounded-md bg-[var(--ozer-accent)]/15"
                  style={{
                    left: `${(r.startMs / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                    width: `${((r.endMs - r.startMs) / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                  }}
                />
              ))}
              {/* Click ticks */}
              {timeline.clicks.map((c) => (
                <div
                  key={`c-${c.tMs}-${c.x}`}
                  className="absolute top-0 z-[2] h-full w-px bg-[color:#F5C518]/70"
                  style={{
                    left: `${(c.tMs / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                  }}
                />
              ))}
              {/* Zoom spans */}
              {timeline.zooms.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  className={cn(
                    'absolute top-0 z-[2] h-2 rounded-b',
                    selectedZoomId === z.id
                      ? 'bg-[var(--ozer-info)]'
                      : 'bg-[var(--ozer-info)]/50',
                  )}
                  style={{
                    left: `${(z.startMs / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                    width: `${((z.endMs - z.startMs) / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedZoomId(z.id);
                  }}
                  title="Zoom"
                />
              ))}
              {selection ? (
                <div
                  className="absolute top-0 bottom-0 z-[2] bg-rose-500/30"
                  style={{
                    left: `${(Math.min(selection.startMs, selection.endMs) / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                    width: `${(Math.abs(selection.endMs - selection.startMs) / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                  }}
                />
              ) : null}
              <div
                className="absolute top-0 bottom-0 z-[3] w-0.5 bg-[var(--workspace-shell-text)]"
                style={{
                  left: `${(playheadMs / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deleteSelection}
                disabled={!selection}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete selection
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={restoreSelectedGap}
                disabled={!selectedGap}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Restore cut
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={undoKeepRanges}
                disabled={undoStack.length === 0}
              >
                <Undo2 className="mr-1.5 h-4 w-4" />
                Undo cut
              </Button>
              {gaps.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUndoStack((stack) => [
                      ...stack.slice(-19),
                      timeline.keepRanges,
                    ]);
                    setSelectedGap(null);
                    saveTimeline({
                      ...timeline,
                      keepRanges: [
                        {
                          startMs: 0,
                          endMs: timeline.sourceDurationMs,
                        },
                      ],
                    });
                    toast.success('Restored full timeline');
                  }}
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Restore all
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const id = crypto.randomUUID();
                  const start = playheadMs;
                  const end = Math.min(
                    timeline.sourceDurationMs,
                    playheadMs + 1800,
                  );
                  const zoom: VideoZoomKeyframe = {
                    id,
                    startMs: start,
                    endMs: end,
                    scale: 1.65,
                    cx: 0.5,
                    cy: 0.5,
                    easeInMs: 280,
                    easeOutMs: 320,
                  };
                  setSelectedZoomId(id);
                  saveTimeline({
                    ...timeline,
                    zooms: [...timeline.zooms, zoom].sort(
                      (a, b) => a.startMs - b.startMs,
                    ),
                  });
                }}
              >
                <ZoomIn className="mr-1.5 h-4 w-4" />
                Add zoom here
              </Button>
              <label className="ml-auto flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                Click ripples
                <Switch
                  checked={timeline.clickStyle.enabled}
                  onCheckedChange={(enabled) =>
                    saveTimeline({
                      ...timeline,
                      clickStyle: { ...timeline.clickStyle, enabled },
                    })
                  }
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className={cn(workspacePanelCard, 'p-4')}>
            <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Audio mix
            </h3>
            {hasDualAudio ? (
              <div className="mt-3 space-y-4 text-sm">
                {(
                  [
                    ['mic', 'Microphone', micUrl] as const,
                    ['system', 'System sound', systemUrl] as const,
                  ] as const
                ).map(([key, label, url]) => {
                  const track = timeline.audio[key];
                  const available = Boolean(url);
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                          {label}
                          {!available ? ' (not recorded)' : ''}
                        </span>
                        <label className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                          Mute
                          <Switch
                            checked={track.muted || !available}
                            disabled={!available}
                            onCheckedChange={(muted) =>
                              saveTimeline({
                                ...timeline,
                                audio: {
                                  ...timeline.audio,
                                  [key]: { ...track, muted },
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.05}
                        disabled={!available || track.muted}
                        value={track.gain}
                        className="w-full"
                        onChange={(e) =>
                          saveTimeline({
                            ...timeline,
                            audio: {
                              ...timeline.audio,
                              [key]: {
                                ...track,
                                gain: Number(e.target.value),
                              },
                            },
                          })
                        }
                      />
                    </div>
                  );
                })}
                <p className="text-[10px] text-[var(--workspace-shell-text-muted)]">
                  Levels apply on the public link immediately after publish. The
                  embed bake mixes them into one track.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Master volume
                  </span>
                  <label className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                    Mute
                    <Switch
                      checked={timeline.audio.mic.muted}
                      onCheckedChange={(muted) =>
                        saveTimeline({
                          ...timeline,
                          audio: {
                            ...timeline.audio,
                            mic: { ...timeline.audio.mic, muted },
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <p className="text-[10px] text-[var(--workspace-shell-text-muted)]">
                  Dual mic/system levels need a new recording from the updated
                  Mac app.
                </p>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  disabled={timeline.audio.mic.muted}
                  value={timeline.audio.mic.gain}
                  className="w-full"
                  onChange={(e) =>
                    saveTimeline({
                      ...timeline,
                      audio: {
                        ...timeline.audio,
                        mic: {
                          ...timeline.audio.mic,
                          gain: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </div>
            )}
          </div>

          <div className={cn(workspacePanelCard, 'p-4')}>
            <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Zoom
            </h3>
            {selectedZoom ? (
              <div className="mt-3 space-y-3 text-sm">
                <label className="block text-xs text-[var(--workspace-shell-text-muted)]">
                  Scale ({selectedZoom.scale.toFixed(2)}×)
                  <input
                    type="range"
                    min={1.1}
                    max={2.8}
                    step={0.05}
                    value={selectedZoom.scale}
                    className="mt-1 w-full"
                    onChange={(e) =>
                      updateZoom({
                        id: selectedZoom.id,
                        scale: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="block text-xs text-[var(--workspace-shell-text-muted)]">
                  Focus X
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedZoom.cx}
                    className="mt-1 w-full"
                    onChange={(e) =>
                      updateZoom({
                        id: selectedZoom.id,
                        cx: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="block text-xs text-[var(--workspace-shell-text-muted)]">
                  Focus Y
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedZoom.cy}
                    className="mt-1 w-full"
                    onChange={(e) =>
                      updateZoom({
                        id: selectedZoom.id,
                        cy: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    saveTimeline({
                      ...timeline,
                      zooms: timeline.zooms.filter(
                        (z) => z.id !== selectedZoom.id,
                      ),
                    });
                    setSelectedZoomId(null);
                  }}
                >
                  Remove zoom
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
                Select a zoom marker on the timeline, add one at the playhead,
                or auto-suggest from clicks.
              </p>
            )}
          </div>

          <div
            className={cn(
              workspacePanelCard,
              'flex min-h-[16rem] flex-col p-4',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Transcript
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleTranscribe()}
                disabled={isPending}
              >
                <Scissors className="mr-1.5 h-4 w-4" />
                {transcript ? 'Re-time with Whisper' : 'Generate'}
              </Button>
            </div>
            {transcript?.words?.length ? (
              <>
                <div className="mt-3 max-h-64 flex-1 overflow-y-auto text-sm leading-relaxed text-[var(--workspace-shell-text)]">
                  {transcript.words.map((w, i) => {
                    const selected = selectedWordIndexes.includes(i);
                    return (
                      <button
                        key={`${w.startMs}-${i}`}
                        type="button"
                        className={cn(
                          'mr-1 inline rounded px-0.5',
                          selected
                            ? 'bg-[var(--ozer-accent)]/25 text-[var(--workspace-shell-accent-text)]'
                            : 'hover:bg-[var(--workspace-shell-sidebar-accent)]',
                        )}
                        onClick={(e) => {
                          setPlayheadMs(w.startMs);
                          if (videoRef.current) {
                            videoRef.current.currentTime = w.startMs / 1000;
                          }
                          setSelectedWordIndexes((prev) => {
                            if (e.shiftKey && prev.length) {
                              const a = Math.min(prev[0]!, i);
                              const b = Math.max(prev[prev.length - 1]!, i);
                              return Array.from(
                                { length: b - a + 1 },
                                (_, k) => a + k,
                              );
                            }
                            return prev.includes(i)
                              ? prev.filter((x) => x !== i)
                              : [...prev, i].sort((x, y) => x - y);
                          });
                        }}
                      >
                        {w.text}
                      </button>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  disabled={selectedWordIndexes.length === 0}
                  onClick={cutSelectedWords}
                >
                  Remove selected words from video
                </Button>
              </>
            ) : (
              <p className="mt-3 text-xs text-[var(--workspace-shell-text-muted)]">
                Desktop transcripts upload with the recording. Or generate a
                word-timed Whisper transcript here, then highlight text to cut.
              </p>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={confirmChaptersOpen}
        onOpenChange={setConfirmChaptersOpen}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing chapters?</AlertDialogTitle>
            <AlertDialogDescription>
              AI generation will overwrite the current chapter list on this
              video.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmChaptersOpen(false);
                void runGenerateChapters();
              }}
            >
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmSummaryOpen}
        onOpenChange={setConfirmSummaryOpen}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing summary?</AlertDialogTitle>
            <AlertDialogDescription>
              AI generation will overwrite the current summary on this video.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSummaryOpen(false);
                void runGenerateSummary();
              }}
            >
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function uploadBlobToBunny(
  file: File,
  credentials: {
    bunnyVideoId: string;
    libraryId: string;
    signature: string;
    expiry: number;
    tusEndpoint: string;
    title: string;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: credentials.tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000],
      chunkSize: 50 * 1024 * 1024,
      headers: {
        AuthorizationSignature: credentials.signature,
        AuthorizationExpire: String(credentials.expiry),
        VideoId: credentials.bunnyVideoId,
        LibraryId: credentials.libraryId,
      },
      metadata: {
        filetype: file.type || 'video/webm',
        title: credentials.title,
      },
      onError: (error) => reject(error),
      onSuccess: () => resolve(),
    });
    void upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]!);
      upload.start();
    });
  });
}
