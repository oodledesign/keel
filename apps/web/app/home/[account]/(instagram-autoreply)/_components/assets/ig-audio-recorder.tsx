'use client';

import { useEffect, useRef, useState } from 'react';

import { Loader2, Mic, RotateCcw, Square, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { IG_AUDIO_MAX_DURATION_MS } from '~/lib/instagram-autoreply/audio/detect-format';
import {
  type IgAssetListItem,
  analyseAudioFile,
  formatDuration,
  uploadIgAsset,
} from '~/lib/instagram-autoreply/audio/upload-asset.client';
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import { IgWaveform } from './ig-waveform';

/** Prefer audio/mp4 (Safari, newer Chrome) so less transcoding is needed. */
function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of [
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function nowMs() {
  return Date.now();
}

type Take = {
  blob: Blob;
  url: string;
  durationMs: number | null;
  peaks: number[] | null;
};

type IgAudioRecorderProps = {
  accountId: string;
  onSaved: (asset: IgAssetListItem) => void;
};

export function IgAudioRecorder({ accountId, onSaved }: IgAudioRecorderProps) {
  const [state, setState] = useState<
    'idle' | 'recording' | 'recorded' | 'uploading'
  >('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'recording' | 'upload'>('recording');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (take?.url) URL.revokeObjectURL(take.url);
    };
  }, [take?.url]);

  async function acceptBlob(blob: Blob, from: 'recording' | 'upload') {
    const analysis = await analyseAudioFile(blob);
    if (
      analysis.durationMs !== null &&
      analysis.durationMs > IG_AUDIO_MAX_DURATION_MS + 750
    ) {
      setError('Voice notes must be 60 seconds or shorter.');
      setState('idle');
      return;
    }
    setSource(from);
    setTake({
      blob,
      url: URL.createObjectURL(blob),
      durationMs: analysis.durationMs,
      peaks: analysis.peaks,
    });
    setState('recorded');
  }

  async function startRecording() {
    setError(null);
    setTake(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const type = recorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (blob.size === 0) {
          setState('idle');
          setError('Nothing was recorded. Please try again.');
          return;
        }
        void acceptBlob(blob, 'recording');
      };
      recorder.start(250);
      startedAtRef.current = nowMs();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        const elapsed = nowMs() - startedAtRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= IG_AUDIO_MAX_DURATION_MS) {
          stopRecording();
        }
      }, 200);
      setState('recording');
    } catch {
      setError('Microphone access is needed to record a voice note.');
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function reset() {
    setTake(null);
    setElapsedMs(0);
    setError(null);
    setState('idle');
  }

  async function save() {
    if (!take) return;
    const name =
      label.trim() || `Voice note ${new Date().toLocaleString('en-GB')}`;
    setState('uploading');
    try {
      const asset = await uploadIgAsset({
        accountId,
        kind: 'audio',
        source,
        label: name,
        file: take.blob,
        waveform: take.peaks,
      });
      toast.success('Voice note saved');
      onSaved(asset);
      setLabel('');
      reset();
    } catch (err) {
      setState('recorded');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Record a voice note</p>
        <span className={`text-xs tabular-nums ${workspaceTextMuted}`}>
          {state === 'recording'
            ? `${formatDuration(elapsedMs)} / 1:00`
            : take
              ? formatDuration(take.durationMs)
              : 'Up to 60 seconds'}
        </span>
      </div>

      {take ? (
        <div className="space-y-2">
          <IgWaveform peaks={take.peaks} />
          <audio controls src={take.url} className="h-9 w-full" />
        </div>
      ) : state === 'recording' ? (
        <div className="flex h-8 items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--ozer-accent)]" />
          <span className="text-sm">Recording…</span>
        </div>
      ) : null}

      {take ? (
        <div className="space-y-1.5">
          <Label htmlFor="ig-voice-label">Label</Label>
          <Input
            id="ig-voice-label"
            value={label}
            maxLength={120}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Welcome voice note"
          />
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-[var(--ozer-accent)]">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {state === 'idle' ? (
          <>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              onClick={() => void startRecording()}
              data-test="ig-record-start"
            >
              <Mic className="h-4 w-4" />
              Record
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload audio
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.m4a,.aac,.wav,.mp3,.webm,.ogg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (!label) setLabel(file.name.replace(/\.[^.]+$/, ''));
                void acceptBlob(file, 'upload');
              }}
            />
          </>
        ) : null}

        {state === 'recording' ? (
          <Button
            type="button"
            variant="outline"
            onClick={stopRecording}
            data-test="ig-record-stop"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        ) : null}

        {state === 'recorded' || state === 'uploading' ? (
          <>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              onClick={() => void save()}
              disabled={state === 'uploading'}
              data-test="ig-record-save"
            >
              {state === 'uploading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {state === 'uploading' ? 'Converting…' : 'Save to library'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={state === 'uploading'}
            >
              <RotateCcw className="h-4 w-4" />
              Re-record
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
