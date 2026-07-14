'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link from 'next/link';

import {
  Archive,
  Building2,
  Calendar,
  ExternalLink,
  Eye,
  FileText,
  Mail,
  MapPin,
  Mic,
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

import pathsConfig from '~/config/paths.config';

import { MeetingTranscriptsBlock } from '../../_components/meeting-transcripts-block';
import { ContextWorkspaceNotes } from '../../_components/workspace-content/context-workspace-notes';
import type { LinkValue } from '../../_components/workspace-content/link-to-select';
import type {
  RanklyClientImportOption,
  RanklyProjectRow,
} from '../../_lib/server/rankly-account-data';
import type {
  DocListItem,
  LinkOption,
  NoteListItem,
  WorkspaceNotesVariant,
} from '../../_lib/workspace-content/types';
import { listMeetingTranscripts } from '../../meeting-transcripts/_lib/server/server-actions';
import { meetingDisplayDate } from '../../meetings/_lib/format-meeting-date';
import { listClientUpcomingBookingsAction } from '../../scheduling/_lib/server/scheduling-actions';
import type { ClientBookingRow } from '../../scheduling/_lib/server/scheduling.service';
import type { ClientDetailOverviewSeed } from '../_lib/client-detail.types';
import {
  deleteClient,
  getClient,
  getClientPortalStatus,
  getJobHistory,
  listNotes,
} from '../_lib/server/server-actions';
import { ClientContactsBlock } from './client-contacts-block';
import { ClientFinancePanel } from './client-finance-panel';
import { ClientForm } from './client-form';
import { ClientImageUploader } from './client-image-uploader';
import { ClientInvoicesBlock } from './client-invoices-block';
import { ClientJobHistoryBlock } from './client-job-history-block';
import { ClientNotesBlock } from './client-notes-block';
import { ClientRanklyBlock } from './client-rankly-block';
import { ClientTasksBlock } from './client-tasks-block';
import { ClientUpcomingBookingsBlock } from './client-upcoming-bookings-block';

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

type DetailTab =
  | 'overview'
  | 'contacts'
  | 'projects'
  | 'invoices'
  | 'finance'
  | 'meetings'
  | 'notes'
  | 'tasks';

type ClientJobSummary = {
  id: string;
  title: string | null;
  status: string;
  value_pence: number | null;
  created_at: string;
  updated_at: string;
};

type ClientNotePreview = {
  id: string;
  note: string;
  created_at: string;
};

type ClientMeetingPreview = {
  id: string;
  title: string;
  meetingDate: string | null;
  createdAt: string;
};

type ClientBookingPreview = Pick<
  ClientBookingRow,
  'id' | 'startAt' | 'eventTypeName'
> & {
  inviteeName: string | null;
};

function formatNotePreview(note: string, maxLength = 120) {
  const trimmed = note.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}…`;
}

function OverviewPreviewPanel({
  title,
  icon: Icon,
  viewAllLabel,
  onViewAll,
  children,
}: {
  title: string;
  icon: typeof Mic;
  viewAllLabel: string;
  onViewAll: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--workspace-shell-text)]">
          <Icon className="h-4 w-4 text-[var(--ozer-accent-muted)]" />
          {title}
        </h3>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-[var(--ozer-accent-muted)] hover:underline"
        >
          {viewAllLabel}
        </button>
      </div>
      {children}
    </section>
  );
}

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

function OverviewMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/60 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--workspace-shell-text)]">
        {value}
      </p>
    </div>
  );
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
  initialClient = null,
  overviewSeed,
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
  initialClient?: Client | null;
  overviewSeed?: ClientDetailOverviewSeed;
}) {
  const hasServerSeed = Boolean(initialClient);
  const [client, setClient] = useState<Client | null>(initialClient ?? null);
  const [jobs, setJobs] = useState<ClientJobSummary[]>(
    (overviewSeed?.jobs as ClientJobSummary[] | undefined) ?? [],
  );
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [loading, setLoading] = useState(!hasServerSeed);
  const [showEditForm, setShowEditForm] = useState(false);
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null);
  const [overviewClientNotes, setOverviewClientNotes] = useState<
    ClientNotePreview[]
  >(overviewSeed?.notes ?? []);
  const [overviewMeetings, setOverviewMeetings] = useState<
    ClientMeetingPreview[]
  >(overviewSeed?.meetings ?? []);
  const [overviewBookings, setOverviewBookings] = useState<
    ClientBookingPreview[]
  >(overviewSeed?.bookings ?? []);

  const fetchClient = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!silent) setLoading(true);
      try {
        const data = (await getClient({
          accountId,
          clientId,
        })) as unknown as Client;
        setClient(data);
        const [jobHistory, notesData, meetingsData, bookingsData] =
          await Promise.all([
            getJobHistory({ accountId, clientId }),
            listNotes({ accountId, clientId }).catch(() => []),
            listMeetingTranscripts({ accountId, clientId }).catch(() => []),
            listClientUpcomingBookingsAction({ accountId, clientId }).catch(
              () => [],
            ),
          ]);
        setJobs(
          Array.isArray(jobHistory) ? (jobHistory as ClientJobSummary[]) : [],
        );
        setOverviewClientNotes((notesData ?? []) as ClientNotePreview[]);
        setOverviewMeetings(
          (meetingsData ?? []).map(
            (meeting: {
              id: string;
              title: string;
              meetingDate: string | null;
              createdAt: string;
            }) => ({
              id: meeting.id,
              title: meeting.title,
              meetingDate: meeting.meetingDate,
              createdAt: meeting.createdAt,
            }),
          ),
        );
        setOverviewBookings(
          ((bookingsData ?? []) as ClientBookingRow[]).map((booking) => ({
            id: booking.id,
            startAt: booking.startAt,
            eventTypeName: booking.eventTypeName,
            inviteeName: booking.inviteeName,
          })),
        );

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
        if (!silent) {
          toast.error(
            e instanceof Error ? e.message : 'Failed to load client',
          );
          setClient(null);
          setPortalStatus(null);
          setOverviewClientNotes([]);
          setOverviewMeetings([]);
          setOverviewBookings([]);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [accountId, accountSlug, clientId],
  );

  useEffect(() => {
    if (hasServerSeed) {
      const email = initialClient?.email;
      if (email) {
        void getClientPortalStatus({ accountSlug, email })
          .then((status) => setPortalStatus(status as unknown as PortalStatus))
          .catch(() => setPortalStatus(null));
      }
      return;
    }

    void fetchClient();
  }, [accountSlug, fetchClient, hasServerSeed, initialClient]);

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

  const meetingDetailBase = pathsConfig.app.accountMeetingDetail
    .replace('[account]', accountSlug)
    .replace('[transcriptId]', '');

  const recentNotesPreview = useMemo(() => {
    if (workspaceNotes?.length) {
      return [...workspaceNotes]
        .sort((a, b) =>
          (b.updatedAt || b.createdAt).localeCompare(
            a.updatedAt || a.createdAt,
          ),
        )
        .slice(0, 3)
        .map((note) => ({
          id: note.id,
          title: note.title,
          preview: formatNotePreview(note.content || note.title),
          date: note.updatedAt || note.createdAt,
        }));
    }

    return overviewClientNotes.slice(0, 3).map((note) => ({
      id: note.id,
      title: null as string | null,
      preview: formatNotePreview(note.note),
      date: note.created_at,
    }));
  }, [overviewClientNotes, workspaceNotes]);

  const recentMeetingsPreview = useMemo(() => {
    return [...overviewMeetings]
      .sort((a, b) => {
        const aKey = a.meetingDate ?? a.createdAt.slice(0, 10);
        const bKey = b.meetingDate ?? b.createdAt.slice(0, 10);
        if (aKey !== bKey) {
          return bKey.localeCompare(aKey);
        }
        return b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, 3);
  }, [overviewMeetings]);

  const tabItems = useMemo(() => {
    if (!client || isContractorView) {
      return [] as Array<{ key: DetailTab; label: string; meta?: string }>;
    }

    return (
      [
        ['overview', 'Overview'],
        ...(client.client_type === 'business'
          ? [['contacts', 'Contacts']]
          : []),
        ['projects', 'Projects'],
        ['invoices', 'Invoices'],
        ['finance', 'Finance'],
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
        void fetchClient({ silent: true });
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

    if (activeTab === 'overview') {
      return (
        <div className="space-y-5">
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
                  className="mx-0 h-24 w-24 shrink-0 rounded-xl md:h-28 md:w-28"
                  fallbackClassName="rounded-xl bg-[var(--workspace-shell-panel-hover)] text-2xl text-[var(--workspace-shell-text)]"
                />
              )}

              <div className="min-w-0 flex-1">
                {subtitle ? (
                  <p className="flex items-center gap-1.5 text-sm text-[var(--workspace-shell-text-muted)]">
                    <Building2 className="h-4 w-4 shrink-0" />
                    {subtitle}
                  </p>
                ) : null}

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <OverviewMetric
                    icon={Calendar}
                    label="Client since"
                    value={formatCreatedDate(client.created_at)}
                  />
                  <OverviewMetric
                    icon={Building2}
                    label="Active projects"
                    value={String(activeJobsCount)}
                  />
                  <OverviewMetric
                    icon={Building2}
                    label="Total project value"
                    value={formatPence(totalValuePence)}
                  />
                </div>

                {client.email ? (
                  <p className="mt-4 text-sm text-[var(--workspace-shell-text-muted)]">
                    <Mail className="mr-1.5 inline h-4 w-4 align-text-bottom" />
                    {client.email}
                  </p>
                ) : null}
                {client.phone ? (
                  <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                    <Phone className="mr-1.5 inline h-4 w-4 align-text-bottom" />
                    {client.phone}
                  </p>
                ) : null}
                {address ? (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--workspace-shell-text-muted)]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {address}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 border-t border-[color:var(--workspace-shell-border)] pt-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  Projects
                </h2>
                <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                  {jobsCount} total · {formatPence(totalValuePence)}
                </span>
              </div>

              {jobs.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
                  No projects yet.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-[color:var(--workspace-shell-border)]">
                  {jobs.map((job) => (
                    <li key={job.id}>
                      <Link
                        href={`${jobDetailBase}${job.id}`}
                        className="flex items-center justify-between gap-3 py-3 transition hover:text-[var(--ozer-accent-muted)]"
                      >
                        <span className="truncate text-sm text-[var(--workspace-shell-text)]">
                          {job.title ?? 'Untitled project'}
                        </span>
                        <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)] capitalize">
                          {job.status.replace(/_/g, ' ')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {ranklyEnabled ? (
            <ClientRanklyBlock
              accountSlug={accountSlug}
              accountId={accountId}
              clientId={client.id}
              project={ranklyProject}
              importSeed={ranklyImportSeed}
              clientImportOptions={ranklyClientImportOptions}
            />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <OverviewPreviewPanel
              title="Upcoming bookings"
              icon={Calendar}
              viewAllLabel="View all"
              onViewAll={() => setActiveTab('meetings')}
            >
              {overviewBookings.length === 0 ? (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  No upcoming bookings.
                </p>
              ) : (
                <ul className="space-y-2">
                  {overviewBookings.slice(0, 4).map((booking) => (
                    <li key={booking.id}>
                      <button
                        type="button"
                        onClick={() => setActiveTab('meetings')}
                        className="block w-full rounded-md px-1 py-1 text-left transition hover:bg-[var(--workspace-shell-panel-hover)]"
                      >
                        <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                          {booking.eventTypeName ?? 'Meeting'}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                          {new Date(booking.startAt).toLocaleString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {booking.inviteeName
                            ? ` · ${booking.inviteeName}`
                            : ''}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </OverviewPreviewPanel>

            <OverviewPreviewPanel
              title="Recent recordings"
              icon={Mic}
              viewAllLabel="View all"
              onViewAll={() => setActiveTab('meetings')}
            >
              {recentMeetingsPreview.length === 0 ? (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  No recordings yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentMeetingsPreview.map((meeting) => (
                    <li key={meeting.id}>
                      <Link
                        href={`${meetingDetailBase}${meeting.id}`}
                        className="block rounded-md px-1 py-1 transition hover:bg-[var(--workspace-shell-panel-hover)]"
                      >
                        <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)]">
                          {meeting.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                          {meetingDisplayDate(
                            meeting.meetingDate,
                            meeting.createdAt,
                          )}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </OverviewPreviewPanel>

            <OverviewPreviewPanel
              title="Recent notes"
              icon={FileText}
              viewAllLabel="View all"
              onViewAll={() => setActiveTab('notes')}
            >
              {recentNotesPreview.length === 0 ? (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  No notes yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentNotesPreview.map((note) => (
                    <li key={note.id}>
                      <button
                        type="button"
                        onClick={() => setActiveTab('notes')}
                        className="block w-full rounded-md px-1 py-1 text-left transition hover:bg-[var(--workspace-shell-panel-hover)]"
                      >
                        {note.title ? (
                          <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                            {note.title}
                          </p>
                        ) : null}
                        <p
                          className={cn(
                            'text-sm text-[var(--workspace-shell-text-muted)]',
                            note.title
                              ? 'mt-0.5 line-clamp-2 text-xs'
                              : 'line-clamp-2',
                          )}
                        >
                          {note.preview}
                        </p>
                        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                          {new Date(note.date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </OverviewPreviewPanel>
          </div>

          <div className="space-y-3">
            {client.email && portalStatus ? (
              <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 text-sm">
                <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
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

            <p className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
              <Eye className="h-4 w-4 shrink-0" />
              {formatLastUpdated(client.updated_at)}
            </p>
          </div>
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

    if (activeTab === 'finance') {
      return (
        <ClientFinancePanel
          accountId={accountId}
          accountSlug={accountSlug}
          clientId={client.id}
        />
      );
    }

    if (activeTab === 'meetings') {
      return (
        <div className="space-y-8">
          <ClientUpcomingBookingsBlock
            accountSlug={accountSlug}
            accountId={accountId}
            clientId={client.id}
          />
          <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-6">
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Recordings
            </h3>
            <MeetingTranscriptsBlock
              accountId={accountId}
              accountSlug={accountSlug}
              clientId={client.id}
              canEdit={canEditClients}
              variant="list"
            />
          </div>
        </div>
      );
    }

    if (activeTab === 'notes') {
      if (workspaceNotes && linkOptions && defaultLink) {
        return (
          <section>
            <h3 className="mb-3 text-sm font-medium text-[var(--workspace-shell-text-muted)]">
              Notes and files
            </h3>
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
              void fetchClient({ silent: true });
              onSaved();
            }}
            onDeleted={onDeleted}
            onCancel={() => setShowEditForm(false)}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3 md:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProfileAvatar
                  displayName={displayName}
                  pictureUrl={client.picture_url}
                  className="mx-0 h-9 w-9 shrink-0 rounded-lg"
                  fallbackClassName="rounded-lg bg-[var(--workspace-shell-panel-hover)] text-sm text-[var(--workspace-shell-text)]"
                />
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold text-[var(--workspace-shell-text)]">
                    {displayName}
                  </h1>
                  {subtitle ? (
                    <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </div>

              {canEditClients ? (
                <div className="flex shrink-0 items-center gap-2">
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
          </div>

          {!isContractorView ? (
            <>
              <div className="shrink-0 overflow-x-auto border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 md:px-5">
                <div className="flex min-w-max gap-1">
                  {tabItems.map(({ key, label, meta }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={cn(
                        'border-b-2 px-4 py-3 text-left transition-colors',
                        activeTab === key
                          ? 'border-[var(--ozer-accent)] text-[var(--workspace-shell-text)]'
                          : 'border-transparent text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                      )}
                    >
                      <span className="block text-sm font-medium">{label}</span>
                      {meta ? (
                        <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                          {meta}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
                {renderTabContent()}
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
              {renderTabContent()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
