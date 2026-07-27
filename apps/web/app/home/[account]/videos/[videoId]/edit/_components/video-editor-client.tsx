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
  Scissors,
  Sparkles,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import * as tus from 'tus-js-client';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { bakeEditedVideo } from '~/lib/videos/bake-edited-video.client';
import {
  type VideoEditTimeline,
  type VideoTranscriptWord,
  type VideoZoomKeyframe,
  editedDurationMs,
  normalizeTimeline,
  removeRangeFromKeep,
  suggestZoomsFromClicks,
  zoomAtTime,
} from '~/lib/videos/edit-timeline';
import { workspacePanelCard } from '~/lib/workspace-ui';

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ startMs: number } | null>(null);

  const dirty = revision !== publishedRevision;
  const editedLen = editedDurationMs(timeline.keepRanges);

  useEffect(() => {
    if (!props.hasMaster) return;
    void fetch(`/api/videos/${props.videoId}/master`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.url) setMasterUrl(j.url as string);
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
    setSelection(null);
    saveTimeline({ ...timeline, keepRanges });
    toast.success('Removed selection');
  }, [selection, timeline, saveTimeline]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!selection) return;
      e.preventDefault();
      deleteSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, deleteSelection]);

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
    setSelectedWordIndexes([]);
    saveTimeline({ ...timeline, keepRanges });
    toast.success('Removed transcript selection from video');
  }

  async function handlePublish() {
    if (!masterUrl) {
      toast.error('Master not available');
      return;
    }
    setPublishing(true);
    setPublishProgress('Saving timeline…');
    try {
      // Persist latest timeline first
      const saveRes = await fetch(`/api/videos/${props.videoId}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline }),
      });
      const saveJson = await saveRes.json();
      if (!saveJson.ok) throw new Error('Could not save timeline');
      const latest = normalizeTimeline(saveJson.timeline);
      setRevision(saveJson.revision);
      setTimeline(latest);

      setPublishProgress('Starting publish…');
      const startRes = await fetch(
        `/api/videos/${props.videoId}/edit/republish`,
        { method: 'POST' },
      );
      const startJson = await startRes.json();
      if (!startJson.ok) throw new Error(startJson.error ?? 'Publish failed');

      setPublishProgress('Rendering edit…');
      const blob = await bakeEditedVideo({
        masterUrl,
        timeline: latest,
        onProgress: (p) =>
          setPublishProgress(
            `${p.message ?? 'Rendering'} (${Math.round(p.progress * 100)}%)`,
          ),
      });

      setPublishProgress('Uploading…');
      const file = new File([blob], 'edited.webm', { type: blob.type });
      await uploadBlobToBunny(file, {
        bunnyVideoId: startJson.bunnyVideoId,
        libraryId: startJson.libraryId,
        signature: startJson.signature,
        expiry: startJson.expiry,
        tusEndpoint: startJson.tusEndpoint,
        title: props.videoTitle,
      });

      setPublishProgress('Finalizing…');
      const completeRes = await fetch(
        `/api/videos/${props.videoId}/edit/republish/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: startJson.jobId,
            bunnyVideoId: startJson.bunnyVideoId,
            durationSeconds: Math.round(
              editedDurationMs(latest.keepRanges) / 1000,
            ),
          }),
        },
      );
      const completeJson = await completeRes.json();
      if (!completeJson.ok) {
        throw new Error(completeJson.error ?? 'Finalize failed');
      }

      setPublishedRevision(completeJson.publishedRevision);
      toast.success('Published edit — public link unchanged');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
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
      <div className={cn(workspacePanelCard, 'p-8')}>
        <p className="text-[var(--workspace-shell-text)]">
          This video does not have an editable master yet. Re-upload from the
          Ozer desktop recorder (it now keeps a master), or upload a master file
          from the library.
        </p>
        <Link
          href={videoHref}
          className="mt-4 inline-flex text-sm text-[var(--ozer-accent)]"
        >
          Back to player
        </Link>
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
              'Update published video'
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
              <video
                ref={videoRef}
                src={masterUrl}
                className="h-full w-full object-contain"
                style={
                  activeZoom
                    ? {
                        transform: `scale(${activeZoom.scale})`,
                        transformOrigin: `${activeZoom.cx * 100}% ${activeZoom.cy * 100}%`,
                      }
                    : undefined
                }
                controls
                onTimeUpdate={(e) =>
                  setPlayheadMs(e.currentTarget.currentTime * 1000)
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text-muted)]">
                Loading master…
              </div>
            )}
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

          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--workspace-shell-text-muted)]">
              <span>
                Source {formatMs(timeline.sourceDurationMs)} · Edited{' '}
                {formatMs(editedLen)}
              </span>
              <span>
                {selection
                  ? `Selection ${formatMs(Math.abs(selection.endMs - selection.startMs))} — Backspace to delete`
                  : 'Drag on the timeline to select a range'}
              </span>
            </div>

            <div
              className="relative h-14 cursor-crosshair rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]"
              onPointerDown={onTimelinePointerDown}
              onPointerMove={onTimelinePointerMove}
              onPointerUp={onTimelinePointerUp}
              onPointerLeave={onTimelinePointerUp}
            >
              {/* Kept segments */}
              {timeline.keepRanges.map((r) => (
                <div
                  key={`${r.startMs}-${r.endMs}`}
                  className="absolute top-1 bottom-1 rounded-md bg-[var(--ozer-accent)]/25"
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
                  className="absolute top-0 h-full w-px bg-[color:#F5C518]/70"
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
                    'absolute top-0 h-2 rounded-b',
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
                  className="absolute top-0 bottom-0 bg-rose-500/30"
                  style={{
                    left: `${(Math.min(selection.startMs, selection.endMs) / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                    width: `${(Math.abs(selection.endMs - selection.startMs) / Math.max(1, timeline.sourceDurationMs)) * 100}%`,
                  }}
                />
              ) : null}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[var(--workspace-shell-text)]"
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
                {transcript ? 'Re-run' : 'Generate'}
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
                Generate a word-timed transcript, then highlight text and remove
                those moments from the video.
              </p>
            )}
          </div>
        </div>
      </div>
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
