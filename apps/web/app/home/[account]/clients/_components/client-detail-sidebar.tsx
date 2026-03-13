'use client';

import { useCallback, useEffect, useState } from 'react';

import { Mail, MapPin, Pencil, Phone, Trash2, X } from 'lucide-react';

import { createInvitationsAction } from '@kit/team-accounts/server-actions';
import { Button } from '@kit/ui/button';
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
import { ClientForm } from './client-form';
import { ClientImageUploader } from './client-image-uploader';
import { ClientInvoicesBlock } from './client-invoices-block';
import { ClientJobHistoryBlock } from './client-job-history-block';
import { ClientNotesBlock } from './client-notes-block';
import { ClientTasksBlock } from './client-tasks-block';

import pathsConfig from '~/config/paths.config';

type Client = {
  id: string;
  account_id: string;
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

type DetailTab = 'activity' | 'jobs' | 'invoices' | 'notes' | 'tasks';

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
}: {
  accountSlug: string;
  accountId: string;
  clientId: string;
  canEditClients: boolean;
  isContractorView: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  /** When true, render as full-page layout (e.g. /clients/[id]) instead of narrow sidebar */
  fullPage?: boolean;
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

  const location = client
    ? [client.city, client.company_name].filter(Boolean).join(', ') || '—'
    : '—';
  const address = client
    ? [
        client.address_line_1,
        client.address_line_2,
        client.city,
        client.postcode,
        client.country,
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const jobsCount = jobs.length;
  const activeJobsCount = jobs.filter(
    (job) => job.status !== 'completed' && job.status !== 'cancelled',
  ).length;
  const totalValuePence = jobs.reduce(
    (sum, job) => sum + (job.value_pence ?? 0),
    0,
  );

  if (loading) {
    return (
      <aside className="flex h-full w-full flex-col border-l border-zinc-700 bg-[var(--workspace-shell-panel)] md:w-[380px]">
        <div className="flex items-center justify-end border-b border-zinc-700 p-4">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-zinc-400" />
          </Button>
        </div>
        <div className="p-4">
          <Skeleton className="h-24 w-full rounded-lg bg-zinc-800" />
          <Skeleton className="mt-4 h-20 w-full rounded-lg bg-zinc-800" />
        </div>
      </aside>
    );
  }

  if (!client) {
    return (
      <aside className="flex h-full w-full flex-col border-l border-zinc-700 bg-[var(--workspace-shell-panel)] md:w-[380px]">
        <div className="flex items-center justify-end border-b border-zinc-700 p-4">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-zinc-400" />
          </Button>
        </div>
        <p className="p-4 text-sm text-zinc-400">Client not found.</p>
      </aside>
    );
  }

  return (
    <aside
      className={
        fullPage
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--workspace-shell-panel)]'
          : 'flex h-full w-full flex-col overflow-hidden border-l border-zinc-700 bg-[var(--workspace-shell-panel)] md:w-[380px]'
      }
    >
      <div className="flex items-center justify-end border-b border-zinc-700 p-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:bg-zinc-800 hover:text-white"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {showEditForm ? (
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
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex items-center justify-center">
                <ProfileAvatar
                  displayName={client.display_name ?? ([client.first_name, client.last_name].filter(Boolean).join(' ').trim() || null)}
                  pictureUrl={client.picture_url}
                  className="h-16 w-16"
                  fallbackClassName="bg-zinc-700 text-zinc-200"
                />
              </div>
              <h2 className="text-lg font-semibold text-white">
                {client.display_name ?? 'Unnamed client'}
              </h2>
              <p className="text-sm text-zinc-400">
                {client.company_name ?? location}
              </p>
              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="mt-2 flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400"
                >
                  <Mail className="h-4 w-4" />
                  {client.email}
                </a>
              )}
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="mt-1 flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400"
                >
                  <Phone className="h-4 w-4" />
                  {client.phone}
                </a>
              )}
              {address && (
                <div className="mt-2 flex items-start gap-2 text-sm text-zinc-400">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{address}</span>
                </div>
              )}
              {canEditClients && (
                <div className="mt-3">
                  <ClientImageUploader
                    accountId={client.account_id}
                    clientId={client.id}
                    pictureUrl={client.picture_url}
                    onUpdated={fetchClient}
                  />
                </div>
              )}
            </div>

            {!isContractorView && (
              <>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-3 text-center">
                    <p className="text-xs text-zinc-500">Total Projects</p>
                    <p className="text-lg font-semibold text-white">{jobsCount}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-3 text-center">
                    <p className="text-xs text-zinc-500">Total Value</p>
                    <p className="text-lg font-semibold text-white">
                      {formatPence(totalValuePence)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-3 text-center">
                    <p className="text-xs text-zinc-500">Active</p>
                    <p className="text-lg font-semibold text-white">
                      {activeJobsCount}
                    </p>
                  </div>
                </div>

                {client.email && portalStatus && (
                  <div className="mt-4 rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-3 text-sm text-left">
                    <p className="text-xs text-zinc-500">Portal access</p>
                    <p className="mt-1 text-sm text-white">
                      {portalStatus.status === 'active' && 'Active in portal'}
                      {portalStatus.status === 'invited' && 'Invite sent'}
                      {portalStatus.status === 'expired' && 'Invite expired'}
                      {portalStatus.status === 'not_invited' && 'Not invited'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Last login:{' '}
                      {portalStatus.lastLogin
                        ? new Date(portalStatus.lastLogin).toLocaleString('en-GB')
                        : 'Never'}
                    </p>
                    {portalStatus.latestInviteCreatedAt && (
                      <p className="mt-1 text-xs text-zinc-500">
                        Last invite:{' '}
                        {new Date(
                          portalStatus.latestInviteCreatedAt,
                        ).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="mt-4">
              <div className="mt-3">
                {isContractorView ? (
                  <ClientNotesBlock
                    accountId={accountId}
                    clientId={client.id}
                    canEdit={false}
                    onNoteAdded={fetchClient}
                  />
                ) : (
                  <>
                    <div className="flex gap-1 border-b border-zinc-700">
                      {(
                        [
                          ['activity', 'Activity'],
                          ['jobs', 'Jobs'],
                          ['invoices', 'Invoices'],
                          ['notes', 'Notes'],
                          ['tasks', 'Tasks'],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveTab(key)}
                          className={cn(
                            'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                            activeTab === key
                              ? 'border-emerald-500 text-emerald-400'
                              : 'border-transparent text-zinc-400 hover:text-white',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3">
                      {activeTab === 'activity' && (
                        <div className="space-y-2">
                          <div className="flex gap-3 rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white">New client</p>
                              <p className="text-xs text-zinc-500">
                                {client.display_name ?? 'Client'} added
                              </p>
                              <p className="text-xs text-zinc-500">
                                {new Date(client.created_at).toLocaleDateString('en-GB')}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500">No other activity yet.</p>
                        </div>
                      )}
                      {activeTab === 'jobs' && (
                        <ClientJobHistoryBlock
                          accountSlug={accountSlug}
                          accountId={accountId}
                          clientId={client.id}
                        />
                      )}
                      {activeTab === 'invoices' && (
                        <ClientInvoicesBlock
                          accountSlug={accountSlug}
                          accountId={accountId}
                          clientId={client.id}
                        />
                      )}
                      {activeTab === 'notes' && (
                        <ClientNotesBlock
                          accountId={accountId}
                          clientId={client.id}
                          canEdit={canEditClients}
                          onNoteAdded={fetchClient}
                        />
                      )}
                      {activeTab === 'tasks' && (
                        <ClientTasksBlock
                          clientId={client.id}
                          clientName={client.display_name ?? [client.first_name, client.last_name].filter(Boolean).join(' ').trim() || 'Client'}
                          canEditClients={canEditClients}
                          tasksHref={pathsConfig.app.home + '/tasks'}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 border-t border-zinc-700 pt-4">
              {canEditClients && client.email && (
                <Button
                  variant="outline"
                  className="justify-start border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={async () => {
                    try {
                      const result = await createInvitationsAction({
                        accountSlug,
                        invitations: [{ email: client.email!, role: 'client' }],
                      });

                      if ((result as any).success) {
                        toast.success('Portal invitation sent');
                        fetchClient();
                      } else {
                        toast.error('Failed to send portal invitation');
                      }
                    } catch (e) {
                      toast.error(
                        e instanceof Error
                          ? e.message
                          : 'Failed to send portal invitation',
                      );
                    }
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Invite to Keel portal
                </Button>
              )}
              {canEditClients && (
                <Button
                  variant="ghost"
                  className="justify-start text-white hover:bg-zinc-800"
                  onClick={() => setShowEditForm(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Details
                </Button>
              )}
              {canEditClients && (
                <Button
                  variant="ghost"
                  className="justify-start text-red-400 hover:bg-red-500/10 hover:text-red-400"
                  onClick={async () => {
                    if (!confirm('Delete this client? This cannot be undone.')) return;
                    try {
                      await deleteClient({ accountId, clientId });
                      toast.success('Client deleted');
                      onDeleted();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to delete');
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Contact
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
