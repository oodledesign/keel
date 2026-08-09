'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Spinner } from '@kit/ui/spinner';
import { Textarea } from '@kit/ui/textarea';

import {
  type MediaJobTile,
  MediaJobsGrid,
} from '~/components/media/media-jobs-grid';
import {
  type ImageQualityTier,
  estimateImageBatchCost,
  estimateJobCost,
  resolveImageModelId,
} from '~/lib/billing/media-unit-pricing';
import { MINIMAX_VIDEO_MODEL_ID } from '~/lib/media-generation/models/minimax-video';

type JobRow = MediaJobTile & {
  params?: {
    quality?: ImageQualityTier;
    seed?: number;
  } | null;
  promoted_from_job_id?: string | null;
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
  const [quality, setQuality] = useState<ImageQualityTier>('draft');
  const [variations, setVariations] = useState(1);
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<{
    balance: number;
    required: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [videoConfirm, setVideoConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [refBase64, setRefBase64] = useState<string | null>(null);
  const [refContentType, setRefContentType] = useState<string | null>(null);

  const refreshJobs = useCallback(async () => {
    const params = new URLSearchParams({ accountId: props.accountId });
    if (props.projectId) params.set('projectId', props.projectId);
    const res = await fetch(`/api/media/jobs?${params.toString()}`);
    if (!res.ok) return;
    const json = (await res.json()) as { jobs: JobRow[] };
    setJobs(json.jobs ?? []);
  }, [props.accountId, props.projectId]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const hasRefs = Boolean(refBase64);
  const imageModelId = resolveImageModelId(hasRefs, quality);
  const imageUnitCost = estimateJobCost(imageModelId);
  const imageBatchCost = estimateImageBatchCost({
    hasRefs,
    quality,
    variations,
  });
  const videoCost = estimateJobCost(MINIMAX_VIDEO_MODEL_ID, {
    durationSeconds,
  });
  const cost = mode === 'image' ? imageBatchCost : videoCost;
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

  const mergeJobs = (next: JobRow[]) => {
    setJobs((prev) => {
      const byId = new Map(prev.map((job) => [job.id, job]));
      for (const job of next) byId.set(job.id, job);
      return Array.from(byId.values()).sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      );
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
        if (mode === 'video') {
          const res = await fetch('/api/media/generate/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: props.accountId,
              projectId: props.projectId ?? null,
              clientId: props.clientId ?? null,
              prompt,
              durationSeconds,
              confirmed: true as const,
            }),
          });
          const json = (await res.json()) as {
            job?: JobRow;
            error?: string;
            code?: string;
            balance?: number;
            required?: number;
          };

          if (
            res.status === 402 ||
            json.code === 'INSUFFICIENT_MEDIA_CREDITS'
          ) {
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

          mergeJobs([json.job]);
          setVideoConfirm(false);
          if (json.job.status === 'processing') {
            void pollJob(json.job.id);
          }
          return;
        }

        const res = await fetch('/api/media/generate/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: props.accountId,
            projectId: props.projectId ?? null,
            clientId: props.clientId ?? null,
            prompt,
            quality,
            variations,
            refImageBase64: refBase64,
            refImageContentType: refContentType,
          }),
        });
        const json = (await res.json()) as {
          jobs?: JobRow[];
          completed?: JobRow[];
          failed?: JobRow[];
          error?: string;
          code?: string;
          balance?: number;
          required?: number;
          chargedTotal?: number;
        };

        if (res.status === 402 || json.code === 'INSUFFICIENT_MEDIA_CREDITS') {
          setShortfall({
            balance: json.balance ?? 0,
            required: json.required ?? cost,
          });
          setError(json.error ?? 'Insufficient media credits');
          return;
        }

        const returned = json.jobs ?? json.completed ?? [];
        if (!res.ok && returned.length === 0) {
          setError(json.error ?? 'Generation failed');
          return;
        }

        if (returned.length) mergeJobs(returned);

        if (json.failed?.length) {
          setError(
            `${json.completed?.length ?? 0} of ${variations} succeeded · ${json.failed.length} failed · charged ${json.chargedTotal ?? 0} units`,
          );
        }
      } catch {
        setError('Generation request failed');
      }
    });
  };

  const promote = (job: JobRow) => {
    setPromotingId(job.id);
    startTransition(async () => {
      setError(null);
      setShortfall(null);
      try {
        const res = await fetch('/api/media/generate/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: props.accountId,
            projectId: props.projectId ?? job.project_id ?? null,
            clientId: props.clientId ?? job.client_id ?? null,
            prompt: job.prompt ?? prompt,
            quality: 'quality',
            variations: 1,
            promoteFromJobId: job.id,
          }),
        });
        const json = (await res.json()) as {
          jobs?: JobRow[];
          completed?: JobRow[];
          error?: string;
          code?: string;
          balance?: number;
          required?: number;
        };

        if (res.status === 402 || json.code === 'INSUFFICIENT_MEDIA_CREDITS') {
          setShortfall({
            balance: json.balance ?? 0,
            required:
              json.required ??
              estimateJobCost(resolveImageModelId(true, 'quality')),
          });
          setError(json.error ?? 'Insufficient media credits');
          return;
        }

        const returned = json.jobs ?? json.completed ?? [];
        if (!res.ok || !returned.length) {
          setError(json.error ?? 'Promote failed');
          return;
        }
        mergeJobs(returned);
      } catch {
        setError('Promote request failed');
      } finally {
        setPromotingId(null);
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
          <>
            <div className="space-y-2">
              <Label htmlFor="media-ref">Reference image (optional)</Label>
              <input
                id="media-ref"
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-muted-foreground text-xs">
                With a reference photo we use Nano Banana (identity-preserving).
                Without one we use Flux for cheap text-to-image.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <Label>Quality</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={quality === 'draft' ? 'default' : 'outline'}
                    onClick={() => setQuality('draft')}
                  >
                    Draft ·{' '}
                    {estimateJobCost(resolveImageModelId(hasRefs, 'draft'))} u
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={quality === 'quality' ? 'default' : 'outline'}
                    onClick={() => setQuality('quality')}
                  >
                    Quality ·{' '}
                    {estimateJobCost(resolveImageModelId(hasRefs, 'quality'))} u
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="media-variations">Variations</Label>
                <select
                  id="media-variations"
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                  value={variations}
                  onChange={(e) => setVariations(Number(e.target.value) || 1)}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-xs">
                  Each variation is a separate image and debit — not a collage.
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Total · {imageBatchCost} units ({variations} × {imageUnitCost})
            </p>
          </>
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
            {pending && !promotingId ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : null}
            Generate · {cost} units
          </Button>
          {pending && !promotingId ? (
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
        onPromoteDraft={(job) => promote(job as JobRow)}
        promotingJobId={promotingId}
      />
    </div>
  );
}
