'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Spinner } from '@kit/ui/spinner';
import { Textarea } from '@kit/ui/textarea';

import { MediaJobsGrid } from '~/components/media/media-jobs-grid';
import { estimateJobCost } from '~/lib/billing/media-unit-pricing';
import { FLUX_SCHNELL_MODEL_ID } from '~/lib/media-generation/models/flux-schnell';
import { MINIMAX_VIDEO_MODEL_ID } from '~/lib/media-generation/models/minimax-video';

type JobRow = {
  id: string;
  status: string;
  type: string;
  file_url: string | null;
  thumbnail_url: string | null;
  prompt: string | null;
  error_message: string | null;
  media_credits_charged: number | null;
  created_at: string;
};

export type MediaGeneratePanelProps = {
  accountId: string;
  accountSlug: string;
  projectId?: string | null;
  clientId?: string | null;
};

export function MediaGeneratePanel(props: MediaGeneratePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<{
    balance: number;
    required: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [videoConfirm, setVideoConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [refBase64, setRefBase64] = useState<string | null>(null);
  const [refContentType, setRefContentType] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams({ accountId: props.accountId });
      if (props.projectId) params.set('projectId', props.projectId);
      const res = await fetch(`/api/media/jobs?${params.toString()}`);
      if (!res.ok) return;
      const json = (await res.json()) as { jobs: JobRow[] };
      setJobs(json.jobs ?? []);
    })();
  }, [props.accountId, props.projectId]);

  const imageCost = estimateJobCost(FLUX_SCHNELL_MODEL_ID);
  const videoCost = estimateJobCost(MINIMAX_VIDEO_MODEL_ID, {
    durationSeconds,
  });
  const cost = mode === 'image' ? imageCost : videoCost;
  const topUpHref = `/home/${props.accountSlug}/settings/billing`;

  const pollJob = useCallback(
    async (jobId: string) => {
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch(
          `/api/media/jobs/${jobId}?accountId=${props.accountId}`,
        );
        if (!res.ok) continue;
        const json = (await res.json()) as { job: JobRow };
        setJobs((prev) => {
          const others = prev.filter((j) => j.id !== jobId);
          return [json.job, ...others];
        });
        if (json.job.status === 'complete' || json.job.status === 'failed') {
          return;
        }
      }
    },
    [props.accountId],
  );

  const onFile = async (file: File | null) => {
    if (!file) {
      setRefBase64(null);
      setRefContentType(null);
      return;
    }
    const reader = new FileReader();
    await new Promise<void>((resolve, reject) => {
      reader.onload = () => {
        const result = String(reader.result ?? '');
        const raw = result.includes(',') ? result.split(',')[1]! : result;
        setRefBase64(raw);
        setRefContentType(file.type || 'image/png');
        resolve();
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const generate = () => {
    if (mode === 'video' && !videoConfirm) {
      setError('Confirm the video quote before submitting.');
      return;
    }

    startTransition(async () => {
      setError(null);
      setShortfall(null);
      try {
        const endpoint =
          mode === 'image'
            ? '/api/media/generate/image'
            : '/api/media/generate/video';
        const body =
          mode === 'image'
            ? {
                accountId: props.accountId,
                projectId: props.projectId ?? null,
                clientId: props.clientId ?? null,
                prompt,
                refImageBase64: refBase64,
                refImageContentType: refContentType,
              }
            : {
                accountId: props.accountId,
                projectId: props.projectId ?? null,
                clientId: props.clientId ?? null,
                prompt,
                durationSeconds,
                confirmed: true as const,
              };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as {
          job?: JobRow;
          error?: string;
          code?: string;
          balance?: number;
          required?: number;
        };

        if (res.status === 402 || json.code === 'INSUFFICIENT_MEDIA_CREDITS') {
          setShortfall({
            balance: json.balance ?? 0,
            required: json.required ?? cost,
          });
          setError(json.error ?? 'Insufficient media credits');
          return;
        }

        if (!res.ok || !json.job) {
          setError(json.error ?? 'Generation failed');
          return;
        }

        setJobs((prev) => [
          json.job!,
          ...prev.filter((j) => j.id !== json.job!.id),
        ]);
        setVideoConfirm(false);
        if (json.job.status === 'processing') {
          void pollJob(json.job.id);
        }
      } catch {
        setError('Generation request failed');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'image' ? 'default' : 'outline'}
            onClick={() => setMode('image')}
          >
            Image
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'video' ? 'default' : 'outline'}
            onClick={() => setMode('video')}
          >
            Video
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="media-prompt">Prompt</Label>
          <Textarea
            id="media-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Describe the image or video…"
          />
        </div>
        {mode === 'image' ? (
          <div className="space-y-2">
            <Label htmlFor="media-ref">Reference image (optional)</Label>
            <input
              id="media-ref"
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="media-duration">Duration (seconds)</Label>
            <input
              id="media-duration"
              type="number"
              min={1}
              max={20}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value) || 5)}
              className="border-input bg-background w-24 rounded-md border px-2 py-1 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={videoConfirm}
                onChange={(e) => setVideoConfirm(e.target.checked)}
              />
              I confirm a {durationSeconds}s video (~{videoCost} media units)
            </label>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            disabled={pending || !prompt.trim()}
            onClick={generate}
          >
            {pending ? <Spinner className="mr-2 h-4 w-4" /> : null}
            Generate · {cost} units
          </Button>
          {pending ? (
            <span className="text-muted-foreground text-sm">Generating…</span>
          ) : null}
        </div>
        {error ? (
          <p className="text-destructive text-sm">
            {error}
            {shortfall ? (
              <>
                {' '}
                (have {shortfall.balance}, need {shortfall.required}).{' '}
                <Link href={topUpHref} className="underline">
                  Top up media units
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <MediaJobsGrid
        jobs={jobs}
        accountSlug={props.accountSlug}
        emptyLabel={
          props.projectId
            ? 'No generations for this project yet.'
            : 'No generations yet. Create your first image or video above.'
        }
      />
    </div>
  );
}
