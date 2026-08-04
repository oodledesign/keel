'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

import {
  MediaJobsGrid,
  type MediaJobTile,
} from '~/components/media/media-jobs-grid';

type MediaGalleryClientProps = {
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
  };
}

export function MediaGalleryClient(props: MediaGalleryClientProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(props.initialProjectId ?? 'all');
  const [clientId, setClientId] = useState(props.initialClientId ?? 'all');
  const [type, setType] = useState(props.initialType ?? 'all');
  const [selectedId, setSelectedId] = useState(props.initialJobId);

  const jobs = useMemo(() => {
    return props.initialJobs
      .map(toTile)
      .filter((job) => {
        if (projectId !== 'all' && job.project_id !== projectId) return false;
        if (clientId !== 'all' && job.client_id !== clientId) return false;
        if (type !== 'all' && job.type !== type) return false;
        return true;
      });
  }, [props.initialJobs, projectId, clientId, type]);

  const selected = props.initialJobs.find((j) => String(j.id) === selectedId);

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
              </p>
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
