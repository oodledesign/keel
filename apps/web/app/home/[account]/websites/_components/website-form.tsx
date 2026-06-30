'use client';

import { useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { Website } from '../_lib/server/websites.service';
import type { WebsiteStack, WebsiteStatus } from '../_lib/schema/websites.schema';
import {
  createWebsite,
  listWebsiteClientOrgs,
  updateWebsite,
} from '../_lib/server/server-actions';

type ClientOrgOption = {
  id: string;
  name: string;
};

const stackOptions: { value: WebsiteStack; label: string }[] = [
  { value: 'next-payload', label: 'Next + Payload' },
  { value: 'webflow', label: 'Webflow' },
  { value: 'wordpress', label: 'WordPress' },
  { value: 'other', label: 'Other' },
];

const statusOptions: { value: WebsiteStatus; label: string }[] = [
  { value: 'in-progress', label: 'In progress' },
  { value: 'live', label: 'Live' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

export function WebsiteForm({
  mode,
  accountId,
  accountSlug,
  website,
}: {
  mode: 'create' | 'edit';
  accountId: string;
  accountSlug: string;
  website?: Website | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clientOrgs, setClientOrgs] = useState<ClientOrgOption[]>([]);

  const [form, setForm] = useState({
    name: website?.name ?? '',
    domain: website?.domain ?? '',
    staging_url: website?.stagingUrl ?? '',
    stack: (website?.stack ?? 'other') as WebsiteStack,
    status: (website?.status ?? 'in-progress') as WebsiteStatus,
    client_org_id: website?.clientOrgId ?? '',
    cms_admin_url: website?.cmsAdminUrl ?? '',
    vercel_project_id: website?.vercelProjectId ?? '',
    github_repo_url: website?.githubRepoUrl ?? '',
    supabase_schema: website?.supabaseSchema ?? '',
    notes: website?.notes ?? '',
    hosting_notes: website?.hostingNotes ?? '',
    launched_at: website?.launchedAt
      ? website.launchedAt.slice(0, 10)
      : '',
  });

  useEffect(() => {
    listWebsiteClientOrgs({ accountId })
      .then((rows) => setClientOrgs(rows ?? []))
      .catch(() => setClientOrgs([]));
  }, [accountId]);

  const listHref = pathsConfig.app.accountWebsites.replace(
    '[account]',
    accountSlug,
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name: form.name.trim(),
          domain: form.domain.trim() || null,
          staging_url: form.staging_url.trim() || null,
          stack: form.stack,
          status: form.status,
          client_org_id: form.client_org_id || null,
          cms_admin_url: form.cms_admin_url.trim() || null,
          vercel_project_id: form.vercel_project_id.trim() || null,
          github_repo_url: form.github_repo_url.trim() || null,
          supabase_schema: form.supabase_schema.trim() || null,
          notes: form.notes.trim() || null,
          hosting_notes: form.hosting_notes.trim() || null,
          launched_at: form.launched_at || null,
        };

        if (mode === 'create') {
          const created = await createWebsite({
            accountId,
            ...payload,
          });
          const detailHref = pathsConfig.app.accountWebsiteDetail
            .replace('[account]', accountSlug)
            .replace('[id]', created.id);
          router.push(detailHref);
          router.refresh();
          return;
        }

        if (!website) return;

        await updateWebsite({
          accountId,
          websiteId: website.id,
          ...payload,
        });

        toast.success('Website updated');
        router.push(
          pathsConfig.app.accountWebsiteDetail
            .replace('[account]', accountSlug)
            .replace('[id]', website.id),
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save website',
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-8">
      <section className="space-y-4 rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 md:p-6">
        <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">Basics</h2>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Client marketing site"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              value={form.domain}
              onChange={(event) =>
                setForm((current) => ({ ...current, domain: event.target.value }))
              }
              placeholder="example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staging_url">Staging URL</Label>
            <Input
              id="staging_url"
              value={form.staging_url}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  staging_url: event.target.value,
                }))
              }
              placeholder="staging.example.com"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Stack</Label>
            <Select
              value={form.stack}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  stack: value as WebsiteStack,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select stack" />
              </SelectTrigger>
              <SelectContent>
                {stackOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  status: value as WebsiteStatus,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Client org</Label>
          <Select
            value={form.client_org_id || '__none__'}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                client_org_id: value === '__none__' ? '' : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Link to a client org" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No client linked</SelectItem>
              {clientOrgs.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="launched_at">Launched date</Label>
          <Input
            id="launched_at"
            type="date"
            value={form.launched_at}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                launched_at: event.target.value,
              }))
            }
          />
        </div>
      </section>

      <section className="space-y-4 rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 md:p-6">
        <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">Technical</h2>

        <div className="space-y-2">
          <Label htmlFor="cms_admin_url">CMS admin URL</Label>
          <Input
            id="cms_admin_url"
            value={form.cms_admin_url}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                cms_admin_url: event.target.value,
              }))
            }
            placeholder="https://cms.example.com/admin"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vercel_project_id">Vercel project ID</Label>
            <Input
              id="vercel_project_id"
              value={form.vercel_project_id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  vercel_project_id: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supabase_schema">Supabase schema</Label>
            <Input
              id="supabase_schema"
              value={form.supabase_schema}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  supabase_schema: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="github_repo_url">GitHub repo URL</Label>
          <Input
            id="github_repo_url"
            value={form.github_repo_url}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                github_repo_url: event.target.value,
              }))
            }
            placeholder="https://github.com/org/repo"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 md:p-6">
        <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">Notes</h2>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hosting_notes">Hosting notes</Label>
          <Textarea
            id="hosting_notes"
            value={form.hosting_notes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                hosting_notes: event.target.value,
              }))
            }
            rows={4}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending} className={workspaceBtnPrimaryMd}>
          {isPending
            ? 'Saving…'
            : mode === 'create'
              ? 'Create website'
              : 'Save changes'}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={listHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
