'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';

import {
  Archive,
  Building2,
  Calendar,
  Eye,
  ExternalLink,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
} from 'lucide-react';

import { createInvitationsAction } from '@kit/team-accounts/server-actions';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { Skeleton } from '@kit/ui/skeleton';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  deleteClient,
  getClient,
  getClientPortalStatus,
  getJobHistory,
} from '../_lib/server/server-actions';
import { ClientContactsBlock } from './client-contacts-block';
import { ClientImageUploader } from './client-image-uploader';
import { ClientForm } from './client-form';
import { ClientInvoicesBlock } from './client-invoices-block';
import { ClientJobHistoryBlock } from './client-job-history-block';
import { ContextWorkspaceNotes } from '../../_components/workspace-content/context-workspace-notes';
import { MeetingTranscriptsBlock } from '../../_components/meeting-transcripts-block';
import type { LinkValue } from '../../_components/workspace-content/link-to-select';
import type {
  DocListItem,
  LinkOption,
  NoteListItem,
  WorkspaceNotesVariant,
} from '../../_lib/workspace-content/types';
import { ClientNotesBlock } from './client-notes-block';
import { ClientRanklyBlock } from './client-rankly-block';
import { ClientTasksBlock } from './client-tasks-block';

import type {
  RanklyClientImportOption,
  RanklyProjectRow,
} from '../../_lib/server/rankly-account-data';

import pathsConfig from '~/config/paths.config';

type Client = {
  id: string;
  account_id: string;
  client_type?: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  picture_url: string | null;
  created_at: string;
  updated_at: string;
};

type PortalStatus = {
  status: 'not_invited' | 'invited' | 'expired' | 'active';
  lastLogin: string | null;
  latestInviteCreatedAt: string | null;
  latestInviteExpiresAt: string | null;
  isMember: boolean;
};

type DetailTab = 'activity' | 'contacts' | 'projects' | 'invoices' | 'meetings' | 'notes' | 'tasks';

type ClientJobSummary = {
  id: string;
  title: string | null;
  status: string;
  value_pence: number | null;
  created_at: string;
  updated_at: string;
};

function formatPence(pence: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function formatLastUpdated(updatedAt: string) {
  const date = new Date(updatedAt);
  const datePart = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `Last updated on ${datePart} at ${timePart}`;
}

function formatCreatedDate(createdAt: string) {
  return new Date(createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ClientDetailSidebar({
  accountSlug,
  accountId,
  clientId,
  canEditClients,
  isContractorView,
  onClose,
  onSaved,
  onDeleted,
  fullPage = false,
  portalHref = null,
  workspaceNotes,
  workspaceDocs,
  notesTableAvailable,
  docsTableAvailable,
  linkOptions,
  defaultLink,
  notesVariant = 'work',
  ranklyEnabled = false,
  ranklyProject = null,
  ranklyImportSeed = null,
  ranklyClientImportOptions = [],
}: {
  accountSlug: string;
  accountId: string;
  clientId: string;
  canEditClients: boolean;
  isContractorView: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  fullPage?: boolean;
  portalHref?: string | null;
  workspaceNotes?: NoteListItem[];
  workspaceDocs?: DocListItem[];
  notesTableAvailable?: boolean;
  docsTableAvailable?: boolean;
  linkOptions?: LinkOption[];
  defaultLink?: LinkValue;
  notesVariant?: WorkspaceNotesVariant;
  ranklyEnabled?: boolean;
  ranklyProject?: RanklyProjectRow | null;
  ranklyImportSeed?: RanklyClientImportOption | null;
  ranklyClientImportOptions?: RanklyClientImportOption[];
}) {
  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<ClientJobSummary[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('activity');
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null);

  const fetchClient = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await getClient({ accountId, clientId })) as unknown as Client;
      setClient(data);
      const jobHistory = await getJobHistory({ accountId, clientId });
      setJobs(Array.isArray(jobHistory) ? (jobHistory as ClientJobSummary[]) : []);

      if (data.email) {
        try {
          const status = (await getClientPortalStatus({
            accountSlug,
            email: data.email,
          })) as unknown as PortalStatus;
          setPortalStatus(status);
        } catch {
          setPortalStatus(null);
        }
      } else {
        setPortalStatus(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load client');
      setClient(null);
      setPortalStatus(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, accountSlug, clientId]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  const jobsCount = jobs.length;
  const activeJobsCount = jobs.filter(
    (job) => job.status !== 'completed' && job.status !== 'cancelled',
  ).length;
  const totalValuePence = jobs.reduce(
    (sum, job) => sum + (job.value_pence ?? 0),
    0,
  );

  const jobDetailBase = pathsConfig.app.accountJobDetail
    .replace('[account]', accountSlug)
    .replace('[id]', '');

  const tabItems = useMemo(() => {
    if (!client || isContractorView) {
      return [] as Array<{ key: DetailTab; label: string; meta?: string }>;
    }

    return (
      [
        ['activity', 'Activity'],
        ...(client.client_type === 'business' ? [['contacts', 'Contacts']] : []),
        ['projects', 'Projects'],
        ['invoices', 'Invoices'],
        ['meetings', 'Meetings'],
        ['notes', 'Notes'],
        ['tasks', 'Tasks'],
      ] as Array<[DetailTab, string]>
    ).map(([key, label]) => ({
      key,
      label,
      meta:
        key === 'projects'
          ? String(jobsCount)
          : key === 'invoices'
            ? formatPence(totalValuePence)
            : undefined,
    }));
  }, [client, isContractorView, jobsCount, totalValuePence]);

  const handleArchive = async () => {
    if (
      !confirm(
        'Archive this client? They will be removed from your client list.',
      )
    ) {
      return;
    }

    try {
      await deleteClient({ accountId, clientId });
      toast.success('Client archived');
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to archive client');
    }
  };

  const handleViewAsClient = () => {
    if (portalHref) {
      window.open(portalHref, '_blank', 'noopener,noreferrer');
      return;
    }

    toast.error('Set up your client portal slug in workspace branding first.');
  };

  const handleInviteToPortal = async () => {
    if (!client?.email) {
      return;
    }

    try {
      const result = await createInvitationsAction({
        accountSlug,
        invitations: [{ email: client.email, role: 'client' }],
      });

      if ((result as { success?: boolean }).success) {
        toast.success('Portal invitation sent');
        fetchClient();
      } else {
        toast.error('Failed to send portal invitation');
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to send portal invitation',
      );
    }
  };

  const shellClass = fullPage
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
    : 'flex h-full w-full flex-col overflow-hidden border-l border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] md:w-[380px]';

  if (loading) {
    return (
      <div className={shellClass}>
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
          <div className="flex gap-6">
            <Skeleton className="h-28 w-28 shrink-0 rounded-xl bg-[var(--workspace-control-surface)]" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-48 rounded bg-[var(--workspace-control-surface)]" />
              <Skeleton className="h-4 w-64 rounded bg-[var(--workspace-control-surface)]" />
              <Skeleton className="h-20 w-full rounded bg-[var(--workspace-control-surface)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className={shellClass}>
        <p className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 text-sm text-[var(--workspace-shell-text-muted)]">
          Client not found.
        </p>
      </div>
    );
  }

  const displayName =
    (client.display_name ??
      [client.first_name, client.last_name].filter(Boolean).join(' ').trim()) ||
    'Unnamed client';
  const subtitle = client.company_name ?? client.city ?? null;
  const address = [
    client.address_line_1,
    client.address_line_2,
    client.city,
    client.postcode,
    client.country,
  ]
    .filter(Boolean)
    .join(', ');

  const renderTabContent = () => {
    if (isContractorView) {
      return (
        <ClientNotesBlock
          accountId={accountId}
          clientId={client.id}
          canEdit={false}
          onNoteAdded={fetchClient}
        />
      );
    }

    if (activeTab === 'activity') {
      return (
        <div className="space-y-3">
          <div className="flex gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">New client</p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                {displayName} added on {formatCreatedDate(client.created_at)}
              </p>
            </div>
          </div>

          {!isContractorView && client.email && portalStatus ? (
            <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
                Portal access
              </p>
              <p className="mt-1 text-[var(--workspace-shell-text)]">
                {portalStatus.status === 'active' && 'Active in portal'}
                {portalStatus.status === 'invited' && 'Invite sent'}
                {portalStatus.status === 'expired' && 'Invite expired'}
                {portalStatus.status === 'not_invited' && 'Not invited'}
              </p>
              <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                Last login:{' '}
                {portalStatus.lastLogin
                  ? new Date(portalStatus.lastLogin).toLocaleString('en-GB')
                  : 'Never'}
              </p>
            </div>
          ) : null}

          <p className="text-xs text-[var(--workspace-shell-text-muted)]">No other activity yet.</p>
        </div>
      );
    }

    if (activeTab === 'contacts') {
      return (
        <ClientContactsBlock
          accountId={accountId}
          clientId={client.id}
          canEdit={canEditClients}
        />
      );
    }

    if (activeTab === 'projects') {
      return (
        <ClientJobHistoryBlock
          accountSlug={accountSlug}
          accountId={accountId}
          clientId={client.id}
        />
      );
    }

    if (activeTab === 'invoices') {
      return (
        <ClientInvoicesBlock
          accountSlug={accountSlug}
          accountId={accountId}
          clientId={client.id}
        />
      );
    }

    if (activeTab === 'meetings') {
      return (
        <MeetingTranscriptsBlock
          accountId={accountId}
          accountSlug={accountSlug}
          clientId={client.id}
          canEdit={canEditClients}
          variant="list"
        />
      );
    }

    if (activeTab === 'notes') {
      if (workspaceNotes && linkOptions && defaultLink) {
        return (
          <section>
            <h3 className="mb-3 text-sm font-medium text-[var(--workspace-shell-text-muted)]">Notes and files</h3>
            <ContextWorkspaceNotes
              accountId={accountId}
              accountSlug={accountSlug}
              notes={workspaceNotes}
              docs={workspaceDocs ?? []}
              tableAvailable={notesTableAvailable ?? true}
              docsTableAvailable={docsTableAvailable ?? true}
              linkOptions={linkOptions}
              defaultLink={defaultLink}
              variant={notesVariant}
              canEdit={canEditClients}
            />
          </section>
        );
      }

      return (
        <ClientNotesBlock
          accountId={accountId}
          clientId={client.id}
          canEdit={canEditClients}
          onNoteAdded={fetchClient}
        />
      );
    }

    if (activeTab === 'tasks') {
      return (
        <ClientTasksBlock
          clientId={client.id}
          clientName={displayName}
          canEditClients={canEditClients}
          tasksHref={pathsConfig.app.home + '/tasks'}
          workspaceAccountId={accountId}
        />
      );
    }

    return null;
  };

  return (
    <div className={shellClass}>
      {showEditForm ? (
        <div className="flex-1 overflow-y-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
          <ClientForm
            accountId={accountId}
            mode="edit"
            client={client}
            canEdit={canEditClients}
            onSaved={() => {
              setShowEditForm(false);
              fetchClient();
              onSaved();
            }}
            onDeleted={onDeleted}
            onCancel={() => setShowEditForm(false)}
          />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              {canEditClients ? (
                <ClientImageUploader
                  accountId={accountId}
                  clientId={client.id}
                  displayName={displayName}
                  pictureUrl={client.picture_url}
                  onUpdated={fetchClient}
                />
              ) : (
                <ProfileAvatar
                  displayName={displayName}
                  pictureUrl={client.picture_url}
                  className="h-24 w-24 shrink-0 rounded-xl md:h-28 md:w-28"
                  fallbackClassName="rounded-xl bg-[var(--workspace-shell-panel-hover)] text-2xl text-[var(--workspace-shell-text)]"
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold text-[var(--workspace-shell-text)]">{displayName}</h1>
                      {client.phone ? (
                        <a
                          href={`tel:${client.phone}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] transition hover:border-[var(--ozer-accent)]/40 hover:text-[var(--ozer-accent-muted)]"
                          aria-label="Call client"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      ) : null}
                      {client.email ? (
                        <a
                          href={`mailto:${client.email}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] transition hover:border-[var(--ozer-accent)]/40 hover:text-[var(--ozer-accent-muted)]"
                          aria-label="Email client"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>

                    {subtitle ? (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--workspace-shell-text-muted)]">
                        <Building2 className="h-4 w-4 shrink-0" />
                        {subtitle}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--workspace-shell-text-muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        Client since {formatCreatedDate(client.created_at)}
                      </span>
                      {activeJobsCount > 0 ? (
                        <span>{activeJobsCount} active projects</span>
                      ) : null}
                    </div>

                    {client.email ? (
                      <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">{client.email}</p>
                    ) : null}
                    {client.phone ? (
                      <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">{client.phone}</p>
                    ) : null}
                    {address ? (
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--workspace-shell-text-muted)]">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        {address}
                      </p>
                    ) : null}
                  </div>

                  {canEditClients ? (
                    <div className="flex shrink-0 items-center gap-2 self-start">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                        onClick={() => setShowEditForm(true)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                            aria-label="Client actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]"
                        >
                          <DropdownMenuItem
                            className="cursor-pointer focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                            onClick={handleArchive}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                            onClick={handleViewAsClient}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View as client
                          </DropdownMenuItem>
                          {client.email ? (
                            <>
                              <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
                              <DropdownMenuItem
                                className="cursor-pointer focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                                onClick={handleInviteToPortal}
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                Invite to portal
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}
                </div>

                {!isContractorView ? (
                  <div className="mt-5 border-t border-[color:var(--workspace-shell-border)] pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-medium text-[var(--workspace-shell-text)]">Projects</h2>
                      <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                        {jobsCount} total · {formatPence(totalValuePence)}
                      </span>
                    </div>

                    {jobs.length === 0 ? (
                      <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">No projects yet.</p>
                    ) : (
                      <ul className="mt-3 divide-y divide-white/[0.06]">
                        {jobs.slice(0, 5).map((job) => (
                          <li key={job.id}>
                            <Link
                              href={`${jobDetailBase}${job.id}`}
                              className="flex items-center justify-between gap-3 py-3 transition hover:text-[var(--ozer-accent-muted)]"
                            >
                              <span className="truncate text-sm text-[var(--workspace-shell-text)]">
                                {job.title ?? 'Untitled project'}
                              </span>
                              <span className="shrink-0 text-xs capitalize text-[var(--workspace-shell-text-muted)]">
                                {job.status.replace(/_/g, ' ')}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {ranklyEnabled ? (
            <div className="mt-4">
              <ClientRanklyBlock
                accountSlug={accountSlug}
                accountId={accountId}
                clientId={client.id}
                project={ranklyProject}
                importSeed={ranklyImportSeed}
                clientImportOptions={ranklyClientImportOptions}
              />
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-center gap-2 border-y border-[color:var(--workspace-shell-border)] py-2.5 text-sm text-[var(--workspace-shell-text-muted)]">
            <Eye className="h-4 w-4 shrink-0" />
            <span>{formatLastUpdated(client.updated_at)}</span>
          </div>

          {!isContractorView ? (
            <>
              <div className="mt-4 overflow-x-auto border-b border-[color:var(--workspace-shell-border)]">
                <div className="flex min-w-max gap-1">
                  {tabItems.map(({ key, label, meta }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={cn(
                        'border-b-2 px-4 py-3 text-left transition-colors',
                        activeTab === key
                          ? 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]'
                          : 'border-transparent text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text-muted)]',
                      )}
                    >
                      <span className="block text-sm font-medium">{label}</span>
                      {meta ? (
                        <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">{meta}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-6">
                {renderTabContent()}
              </div>
            </>
          ) : (
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-6">
              {renderTabContent()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
