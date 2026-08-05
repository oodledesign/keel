'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Spinner } from '@kit/ui/spinner';
import { toast } from '@kit/ui/sonner';

import {
  MediaJobsGrid,
  type MediaJobTile,
} from '~/components/media/media-jobs-grid';

type MediaGalleryClientProps = {
  accountId: string;
  accountSlug: string;
  initialJobs: Array<Record<string, unknown>>;
  projects: Array<{ id: string; title?: string | null; name?: string | null }>;
  clients: Array<{
    id: string;
    display_name?: string | null;
    company_name?: string | null;
  }>;
  initialJobId: string | null;
  initialProjectId: string | null;
  initialClientId: string | null;
  initialType: string | null;
};

function toTile(row: Record<string, unknown>): MediaJobTile {
  const params = row.params as MediaJobTile['params'];
  return {
    id: String(row.id),
    status: String(row.status),
    type: String(row.type),
    file_url: (row.file_url as string | null) ?? null,
    thumbnail_url: (row.thumbnail_url as string | null) ?? null,
    prompt: (row.prompt as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    media_credits_charged:
      (row.media_credits_charged as number | null) ?? null,
    created_at: String(row.created_at),
    project_id: (row.project_id as string | null) ?? null,
    client_id: (row.client_id as string | null) ?? null,
    params: params ?? null,
    promoted_from_job_id:
      (row.promoted_from_job_id as string | null) ?? null,
  };
}

export function MediaGalleryClient(props: MediaGalleryClientProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(props.initialProjectId ?? 'all');
  const [clientId, setClientId] = useState(props.initialClientId ?? 'all');
  const [type, setType] = useState(props.initialType ?? 'all');
  const [selectedId, setSelectedId] = useState(props.initialJobId);
  const [jobsState, setJobsState] = useState(props.initialJobs);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const jobs = useMemo(() => {
    return jobsState
      .map(toTile)
      .filter((job) => {
        if (projectId !== 'all' && job.project_id !== projectId) return false;
        if (clientId !== 'all' && job.client_id !== clientId) return false;
        if (type !== 'all' && job.type !== type) return false;
        return true;
      });
  }, [jobsState, projectId, clientId, type]);

  const selected = jobsState.find((j) => String(j.id) === selectedId);
  const selectedTile = selected ? toTile(selected) : null;

  const pushFilters = (next: {
    project?: string;
    client?: string;
    type?: string;
  }) => {
    const params = new URLSearchParams();
    const p = next.project ?? projectId;
    const c = next.client ?? clientId;
    const t = next.type ?? type;
    if (p !== 'all') params.set('project', p);
    if (c !== 'all') params.set('client', c);
    if (t !== 'all') params.set('type', t);
    router.replace(
      `/home/${props.accountSlug}/media${params.size ? `?${params}` : ''}`,
    );
  };

  const promote = (job: MediaJobTile) => {
    setPromotingId(job.id);
    startTransition(async () => {
      try {
        const res = await fetch('/api/media/generate/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: props.accountId,
            projectId: job.project_id,
            clientId: job.client_id,
            prompt: job.prompt ?? 'Promote to quality',
            quality: 'quality',
            variations: 1,
            promoteFromJobId: job.id,
          }),
        });
        const json = (await res.json()) as {
          completed?: Array<Record<string, unknown>>;
          jobs?: Array<Record<string, unknown>>;
          error?: string;
        };
        if (!res.ok) {
          toast.error(json.error ?? 'Promote failed');
          return;
        }
        const added = json.completed ?? json.jobs ?? [];
        if (added.length) {
          setJobsState((prev) => [...added, ...prev]);
          toast.success('Quality version created');
        }
      } catch {
        toast.error('Promote failed');
      } finally {
        setPromotingId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select
          value={projectId}
          onValueChange={(v) => {
            setProjectId(v);
            pushFilters({ project: v });
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {props.projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title?.trim() || p.name?.trim() || 'Untitled'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={clientId}
          onValueChange={(v) => {
            setClientId(v);
            pushFilters({ client: v });
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {props.clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.display_name?.trim() ||
                  c.company_name?.trim() ||
                  'Untitled client'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
            pushFilters({ type: v });
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="video">Video</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <MediaJobsGrid
        jobs={jobs}
        accountSlug={props.accountSlug}
        onSelect={(job) => setSelectedId(job.id)}
        onPromoteDraft={(job) => promote(job)}
        promotingJobId={promotingId}
        emptyLabel="No completed generations yet."
      />

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generated media</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3">
              {String(selected.type) === 'video' && selected.file_url ? (
                <video
                  src={String(selected.file_url)}
                  controls
                  className="max-h-[60vh] w-full rounded-md"
                />
              ) : selected.file_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={String(selected.file_url)}
                  alt={String(selected.prompt ?? '')}
                  className="max-h-[60vh] w-full rounded-md object-contain"
                />
              ) : null}
              <p className="text-sm whitespace-pre-wrap">
                {String(selected.prompt ?? '')}
              </p>
              <p className="text-muted-foreground text-xs">
                Model {String(selected.model_id)} ·{' '}
                {selected.media_credits_charged != null
                  ? `${String(selected.media_credits_charged)} units`
                  : 'units n/a'}
                {(selected.params as { quality?: string } | null)?.quality
                  ? ` · ${(selected.params as { quality?: string }).quality}`
                  : ''}
              </p>
              {selectedTile &&
              selectedTile.type === 'image' &&
              selectedTile.params?.quality !== 'quality' &&
              !selectedTile.promoted_from_job_id ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || promotingId === selectedTile.id}
                  onClick={() => promote(selectedTile)}
                >
                  {promotingId === selectedTile.id ? (
                    <Spinner className="mr-2 h-4 w-4" />
                  ) : null}
                  Promote to quality
                </Button>
              ) : null}
              {selected.project_id ? (
                <Link
                  className="text-sm underline"
                  href={`/home/${props.accountSlug}/projects/${String(selected.project_id)}?tab=generate`}
                >
                  Open project
                </Link>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
