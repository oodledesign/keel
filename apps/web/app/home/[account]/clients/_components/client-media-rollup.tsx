'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { MediaJobsGrid, type MediaJobTile } from '~/components/media/media-jobs-grid';

export function ClientMediaRollup(props: {
  accountId: string;
  accountSlug: string;
  clientId: string;
}) {
  const [jobs, setJobs] = useState<MediaJobTile[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(
        `/api/media/jobs?accountId=${props.accountId}&clientId=${props.clientId}&status=complete`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as { jobs: MediaJobTile[] };
      setJobs(json.jobs ?? []);
    })();
  }, [props.accountId, props.clientId]);

  if (!jobs.length) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Generated media</h3>
        <Link
          href={`/home/${props.accountSlug}/media?client=${props.clientId}`}
          className="text-muted-foreground text-xs underline"
        >
          View all
        </Link>
      </div>
      <MediaJobsGrid
        jobs={jobs.slice(0, 8)}
        accountSlug={props.accountSlug}
        emptyLabel=""
      />
    </section>
  );
}
