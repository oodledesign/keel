'use client';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

export type MediaJobTile = {
  id: string;
  status: string;
  type: string;
  file_url: string | null;
  thumbnail_url: string | null;
  prompt: string | null;
  error_message?: string | null;
  media_credits_charged?: number | null;
  created_at: string;
  project_id?: string | null;
  client_id?: string | null;
};

type MediaJobsGridProps = {
  jobs: MediaJobTile[];
  accountSlug: string;
  emptyLabel?: string;
  onSelect?: (job: MediaJobTile) => void;
};

export function MediaJobsGrid(props: MediaJobsGridProps) {
  if (!props.jobs.length) {
    return (
      <p className="text-muted-foreground text-sm">
        {props.emptyLabel ?? 'No media yet.'}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {props.jobs.map((job) => {
        const thumb = job.thumbnail_url ?? job.file_url;
        const content = (
          <div
            className={cn(
              'bg-muted group overflow-hidden rounded-md border',
              'aspect-square',
            )}
          >
            {job.status === 'complete' && thumb ? (
              job.type === 'video' ? (
                <video
                  src={thumb}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt={job.prompt ?? 'Generated media'}
                  className="h-full w-full object-cover"
                />
              )
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center p-3 text-center text-xs">
                {job.status}
                {job.error_message ? ` · ${job.error_message}` : ''}
              </div>
            )}
          </div>
        );

        if (props.onSelect) {
          return (
            <button
              key={job.id}
              type="button"
              className="text-left"
              onClick={() => props.onSelect?.(job)}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={job.id}
            href={`/home/${props.accountSlug}/media?job=${job.id}`}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
