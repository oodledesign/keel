'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { RanklyClientImportOption } from '~/home/[account]/_lib/server/rankly-account-data';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import type { RanklyProjectRow } from '../../_lib/server/rankly-account-data';
import { deleteRanklyProject } from '../_lib/server/rankly-module-actions';
import { RanklyProjectForm } from './rankly-project-form';

function projectHref(accountSlug: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectDetail
    .replace('[account]', accountSlug)
    .replace('[projectId]', projectId);
}

export function RanklyProjectsManager(props: {
  accountSlug: string;
  accountId: string;
  clientsHref: string;
  projects: RanklyProjectRow[];
  keywordCounts: Record<string, number>;
  clientImportOptions: RanklyClientImportOption[];
  clientLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const remove = async (projectId: string) => {
    if (
      !globalThis.confirm(
        'Delete this project and its keywords? This cannot be undone.',
      )
    ) {
      return;
    }
    setDeletingId(projectId);
    try {
      await deleteRanklyProject({
        accountId: props.accountId,
        projectId,
      });
      toast.success('Project deleted');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-xl text-sm">
          Track domains and keyword sets. Link projects to clients or create one
          for your own business.
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
          clientsHref={props.clientsHref}
          onCreated={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      ) : null}

      {props.projects.length === 0 && !open ? (
        <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
          No projects yet. Use &quot;New project&quot; to add your first domain.
        </p>
      ) : null}

      {props.projects.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Keywords</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={projectHref(props.accountSlug, project.id)}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {project.domain}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {project.client_id
                      ? (props.clientLabels[project.client_id] ?? '—')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {props.keywordCounts[project.id] ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={deletingId === project.id}
                      onClick={() => remove(project.id)}
                    >
                      {deletingId === project.id ? 'Deleting…' : 'Delete'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
