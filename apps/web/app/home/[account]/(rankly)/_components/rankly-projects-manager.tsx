'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import type { RanklyProjectRow } from '../../_lib/server/rankly-account-data';
import {
  createRanklyProject,
  deleteRanklyProject,
} from '../_lib/server/rankly-module-actions';

function projectHref(accountSlug: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectDetail
    .replace('[account]', accountSlug)
    .replace('[projectId]', projectId);
}

export function RanklyProjectsManager(props: {
  accountSlug: string;
  accountId: string;
  projects: RanklyProjectRow[];
  keywordCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !domain.trim()) {
      toast.error('Name and domain are required');
      return;
    }
    setBusy(true);
    try {
      await createRanklyProject({
        accountId: props.accountId,
        name: name.trim(),
        domain: domain.trim(),
        target_country: 'US',
        target_language: 'en',
        track_desktop: true,
        track_mobile: true,
      });
      toast.success('Project created');
      setName('');
      setDomain('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

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
          Track domains and keyword sets. Open a project to add keywords.
        </p>
        <Button
          type="button"
          variant={open ? 'secondary' : 'default'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Cancel' : 'New project'}
        </Button>
      </div>

      {open ? (
        <form
          onSubmit={submit}
          className="max-w-md space-y-4 rounded-lg border border-white/10 bg-black/10 p-4"
        >
          <div className="space-y-2">
            <Label htmlFor="rankly-project-name">Name</Label>
            <Input
              id="rankly-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme SEO"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rankly-project-domain">Domain</Label>
            <Input
              id="rankly-project-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Create project'}
          </Button>
        </form>
      ) : null}

      {props.projects.length === 0 && !open ? (
        <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
          No projects yet. Use &quot;New project&quot; to add your first domain.
        </p>
      ) : null}

      {props.projects.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Keywords</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.projects.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={projectHref(props.accountSlug, p.id)}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.domain}</td>
                  <td className="px-4 py-3">
                    {props.keywordCounts[p.id] ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={deletingId === p.id}
                      onClick={() => remove(p.id)}
                    >
                      {deletingId === p.id ? 'Deleting…' : 'Delete'}
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
