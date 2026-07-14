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
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { listJobs } from '~/home/[account]/jobs/_lib/server/server-actions';
import { deliveryProjectTitle } from '~/lib/projects/project-types';

import type { Website } from '../_lib/server/websites.service';
import type { WebsiteStack, WebsiteStatus } from '../_lib/schema/websites.schema';
import {
  createWebsite,
  updateWebsite,
} from '../_lib/server/server-actions';

type ClientOption = {
  id: string;
  label: string;
};

type JobOption = {
  id: string;
  label: string;
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
  siteStudioEnabled = false,
  initialClients,
}: {
  mode: 'create' | 'edit';
  accountId: string;
  accountSlug: string;
  website?: Website | null;
  /** When true, create defaults to Client + Website design project. */
  siteStudioEnabled?: boolean;
  /** Optional SSR-fetched CRM clients (create flow). */
  initialClients?: ClientOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clients, setClients] = useState<ClientOption[]>(initialClients ?? []);
  const [jobs, setJobs] = useState<JobOption[]>([]);

  const [form, setForm] = useState({
    name: website?.name ?? '',
    domain: website?.domain ?? '',
    staging_url: website?.stagingUrl ?? '',
    stack: (website?.stack ?? 'other') as WebsiteStack,
    status: (website?.status ?? 'in-progress') as WebsiteStatus,
    client_id: website?.linkedClientId ?? '',
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

  const [createDeliveryProject, setCreateDeliveryProject] = useState(
    mode === 'create' && siteStudioEnabled,
  );
  const [linkExistingJob, setLinkExistingJob] = useState(false);
  const [existingJobId, setExistingJobId] = useState('');

  useEffect(() => {
    if (initialClients && initialClients.length > 0) return;
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((result) => {
        const rows = result.data ?? [];
        setClients(
          rows.map(
            (row: {
              id: string;
              display_name?: string | null;
              company_name?: string | null;
            }) => ({
              id: String(row.id),
              label:
                String(
                  row.display_name ?? row.company_name ?? 'Untitled',
                ).trim() || 'Untitled',
            }),
          ),
        );
      })
      .catch(() => setClients([]));
  }, [accountId, initialClients]);

  useEffect(() => {
    if (!linkExistingJob) return;
    listJobs({
      accountId,
      tab: 'active',
      page: 1,
      pageSize: 100,
      query: undefined,
      status: undefined,
      priority: undefined,
    })
      .then((result) => {
        setJobs(
          (result.data ?? []).map((row) => {
            const id = String(
              (row as { id?: unknown }).id ?? '',
            );
            return {
              id,
              label: deliveryProjectTitle(row) || 'Untitled project',
            };
          }),
        );
      })
      .catch(() => setJobs([]));
  }, [accountId, linkExistingJob]);

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

    if (mode === 'create' && (siteStudioEnabled || createDeliveryProject)) {
      if (!form.client_id) {
        toast.error('Pick a CRM client so the website can link to the portal');
        return;
      }
    }

    if (createDeliveryProject && linkExistingJob && !existingJobId) {
      toast.error('Pick an existing project to link');
      return;
    }

    startTransition(async () => {
      try {
        if (mode === 'create') {
          const created = await createWebsite({
            accountId,
            name: form.name.trim(),
            domain: form.domain.trim() || null,
            staging_url: form.staging_url.trim() || null,
            stack: form.stack,
            status: form.status,
            client_id: form.client_id || null,
            client_org_id: null,
            cms_admin_url: form.cms_admin_url.trim() || null,
            vercel_project_id: form.vercel_project_id.trim() || null,
            github_repo_url: form.github_repo_url.trim() || null,
            supabase_schema: form.supabase_schema.trim() || null,
            notes: form.notes.trim() || null,
            hosting_notes: form.hosting_notes.trim() || null,
            launched_at: form.launched_at || null,
            create_delivery_project: createDeliveryProject,
            existing_job_id:
              createDeliveryProject && linkExistingJob
                ? existingJobId || null
                : null,
          });
          const detailHref = pathsConfig.app.accountWebsiteDetail
            .replace('[account]', accountSlug)
            .replace('[id]', created.id);
          toast.success(
            createDeliveryProject
              ? 'Website created with Website design project'
              : 'Website created',
          );
          router.push(detailHref);
          router.refresh();
          return;
        }

        if (!website) return;

        await updateWebsite({
          accountId,
          websiteId: website.id,
          name: form.name.trim(),
          domain: form.domain.trim() || null,
          staging_url: form.staging_url.trim() || null,
          stack: form.stack,
          status: form.status,
          client_org_id: website.clientOrgId,
          cms_admin_url: form.cms_admin_url.trim() || null,
          vercel_project_id: form.vercel_project_id.trim() || null,
          github_repo_url: form.github_repo_url.trim() || null,
          supabase_schema: form.supabase_schema.trim() || null,
          notes: form.notes.trim() || null,
          hosting_notes: form.hosting_notes.trim() || null,
          launched_at: form.launched_at || null,
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
        <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
          Basics
        </h2>

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
                setForm((current) => ({
                  ...current,
                  domain: event.target.value,
                }))
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
          <Label>CRM client</Label>
          <Select
            value={form.client_id || '__none__'}
            onValueChange={(value) =>
              setForm((current) => ({
                ...current,
                client_id: value === '__none__' ? '' : value,
              }))
            }
            disabled={mode === 'edit'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Link a CRM client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No client linked</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {mode === 'create'
              ? 'Resolves (or creates) the portal client organisation used for share/portal access.'
              : website?.clientOrgName
                ? `Portal org: ${website.clientOrgName}`
                : 'Change the linked client org from Edit metadata later if needed.'}
          </p>
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

      {mode === 'create' ? (
        <section className="space-y-4 rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 md:p-6">
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Delivery project
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Apply the Website design template (Brief → Sitemap → Wireframes →
            Design → SEO → Export → Build). Each phase deep-links to Site Studio
            tabs.
          </p>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                {siteStudioEnabled
                  ? 'Create Website design project'
                  : 'Create delivery project (opt in)'}
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                {siteStudioEnabled
                  ? 'Recommended when Site Studio is active.'
                  : 'Optional without Site Studio.'}
              </p>
            </div>
            <Switch
              checked={createDeliveryProject}
              onCheckedChange={(checked) => {
                setCreateDeliveryProject(checked);
                if (!checked) {
                  setLinkExistingJob(false);
                  setExistingJobId('');
                }
              }}
            />
          </div>

          {createDeliveryProject ? (
            <div className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] p-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-[var(--workspace-shell-text)]">
                  Link an existing project instead
                </p>
                <Switch
                  checked={linkExistingJob}
                  onCheckedChange={(checked) => {
                    setLinkExistingJob(checked);
                    if (!checked) setExistingJobId('');
                  }}
                />
              </div>
              {linkExistingJob ? (
                <Select
                  value={existingJobId || '__none__'}
                  onValueChange={(value) =>
                    setExistingJobId(value === '__none__' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select project…</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4 rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 md:p-6">
        <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
          Technical
        </h2>

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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            rows={3}
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
            rows={2}
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
        <Button asChild type="button" variant="ghost">
          <Link href={listHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
