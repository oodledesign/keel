'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import type { RanklyClientImportOption } from '~/home/[account]/_lib/server/rankly-account-data';

import { RanklyProjectForm } from './rankly-project-form';

function projectHref(accountSlug: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectDetail
    .replace('[account]', accountSlug)
    .replace('[projectId]', projectId);
}

export function RanklyDashboardProjectsPanel(props: {
  accountSlug: string;
  accountId: string;
  clientImportOptions: RanklyClientImportOption[];
  projects: Array<{
    id: string;
    name: string;
    domain: string;
    client_id: string | null;
  }>;
  keywordCounts: Record<string, number>;
  clientLabels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-xl text-sm">
          Track SEO for client sites or your own business. Link a project to a
          client to jump back from their CRM record.
        </p>
        <Button
          type="button"
          variant={open ? 'secondary' : 'default'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Cancel' : 'New project'}
        </Button>
      </div>

      {open ? (
        <RanklyProjectForm
          accountId={props.accountId}
          clientImportOptions={props.clientImportOptions}
          onCreated={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      ) : null}

      {props.projects.length === 0 && !open ? (
        <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
          No projects yet. Use &quot;New project&quot; to add a domain manually
          or import details from a client.
        </p>
      ) : null}

      {props.projects.length > 0 ? (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {props.projects.slice(0, 6).map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={projectHref(props.accountSlug, project.id)}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {project.name}
                </Link>
                <p className="text-muted-foreground text-sm">{project.domain}</p>
                {project.client_id && props.clientLabels[project.client_id] ? (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Client: {props.clientLabels[project.client_id]}
                  </p>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">
                {props.keywordCounts[project.id] ?? 0} keywords
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
