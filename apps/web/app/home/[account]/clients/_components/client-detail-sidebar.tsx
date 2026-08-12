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
  Globe,
  Mail,
  MapPin,
  Mic,
  MoreHorizontal,
  Pencil,
  Phone,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
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
import { ClientSubscriptionStatusList } from '~/home/[account]/_components/client-subscription-status-list';
import { websiteHref } from '~/lib/clients/client-logo-domain';
import { inviteAllContactsToPortalAction } from '~/lib/clients/client-portal-invites-actions';
import type { CommercialClientRole } from '~/lib/commercial/commercial-constants';
import { useWorkspaceCurrency } from '~/lib/currency/use-workspace-currency';
import { formatWorkspaceMoney } from '~/lib/currency/workspace-currency';

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
import { ensureClientOrgForCrmClientAction } from '../_lib/server/client-support-link-actions';
import {
  deleteClient,
  getClient,
  getJobHistory,
  listClientDisposals,
  listClientRequirements,
  listClientViewings,
  listContacts,
  listNotes,
} from '../_lib/server/server-actions';
import { AttachRetainerPlanButton } from './attach-retainer-plan-button';
import {
  ClientDisposalsBlock,
  ClientLeasesBlock,
  ClientRequirementsBlock,
  ClientSalesBlock,
  ClientViewingsBlock,
} from './client-commercial-blocks';
import { ClientContactsBlock } from './client-contacts-block';
import { ClientFinancePanel } from './client-finance-panel';
import { ClientForm } from './client-form';
import { ClientImageUploader } from './client-image-uploader';
import { ClientInvoicesBlock } from './client-invoices-block';
import { ClientJobHistoryBlock } from './client-job-history-block';
import { ClientMediaRollup } from './client-media-rollup';
import { ClientNotesBlock } from './client-notes-block';
import { ClientRanklyBlock } from './client-rankly-block';
import { ClientSupportBlock } from './client-support-block';
import { ClientTasksBlock } from './client-tasks-block';
import { ClientUpcomingBookingsBlock } from './client-upcoming-bookings-block';

type Client = {
  id: string;
  account_id: string;
  client_org_id?: string | null;
  client_type?: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website?: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  picture_url: string | null;
  commercial_role?: CommercialClientRole | null;
  created_at: string;
  updated_at: string;
};

type DetailTab =
  | 'overview'
  | 'contacts'
  | 'projects'
  | 'invoices'
  | 'finance'
  | 'meetings'
  | 'notes'
  | 'tasks'
  | 'support'
  | 'disposals'
  | 'requirements'
  | 'viewings'
  | 'leases'
  | 'sales';

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
          <Icon className="h-4 w-4 text-[var(--ozer-accent-pressed)]" />
          {title}
        </h3>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-[var(--ozer-accent-pressed)] hover:underline"
        >
          {viewAllLabel}
        </button>
      </div>
      {children}
    </section>
  );
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
  onClose: _onClose,
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
  showCommercialRole = false,
  variant = 'work',
  ranklyEnabled = false,
  ranklyProject = null,
  ranklyImportSeed = null,
  ranklyClientImportOptions = [],
  initialClient = null,
  overviewSeed,
  supportEnabled = false,
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
  showCommercialRole?: boolean;
  variant?: 'work' | 'commercial';
  ranklyEnabled?: boolean;
  ranklyProject?: RanklyProjectRow | null;
  ranklyImportSeed?: RanklyClientImportOption | null;
  ranklyClientImportOptions?: RanklyClientImportOption[];
  initialClient?: Client | null;
  overviewSeed?: ClientDetailOverviewSeed;
  supportEnabled?: boolean;
}) {
  const isCommercial = variant === 'commercial';
  const workspaceCurrency = useWorkspaceCurrency();
  const formatMoney = (pence: number) =>
    formatWorkspaceMoney(pence, workspaceCurrency);
  const hasServerSeed = Boolean(initialClient);
  const [client, setClient] = useState<Client | null>(initialClient ?? null);
  const [jobs, setJobs] = useState<ClientJobSummary[]>(
    (overviewSeed?.jobs as ClientJobSummary[] | undefined) ?? [],
  );
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [loading, setLoading] = useState(!hasServerSeed);
  const [showEditForm, setShowEditForm] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [overviewClientNotes, setOverviewClientNotes] = useState<
    ClientNotePreview[]
  >(overviewSeed?.notes ?? []);
  const [overviewMeetings, setOverviewMeetings] = useState<
    ClientMeetingPreview[]
  >(overviewSeed?.meetings ?? []);
  const [overviewBookings, setOverviewBookings] = useState<
    ClientBookingPreview[]
  >(overviewSeed?.bookings ?? []);
  const [resolvedClientOrgId, setResolvedClientOrgId] = useState<string | null>(
    initialClient?.client_org_id ?? null,
  );
  const [commercialMetrics, setCommercialMetrics] = useState({
    disposals: 0,
    requirements: 0,
    viewings: 0,
  });

  useEffect(() => {
    if (!isCommercial) return;

    let cancelled = false;

    void Promise.all([
      listClientDisposals({ accountId, clientId }),
      listClientRequirements({ accountId, clientId }),
      listClientViewings({ accountId, clientId }),
    ])
      .then(([disposals, requirements, viewings]) => {
        if (cancelled) return;
        setCommercialMetrics({
          disposals: disposals?.length ?? 0,
          requirements: requirements?.length ?? 0,
          viewings: viewings?.length ?? 0,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCommercialMetrics({ disposals: 0, requirements: 0, viewings: 0 });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, clientId, isCommercial]);

  useEffect(() => {
    if (!supportEnabled && !canEditClients) return;
    if (resolvedClientOrgId) return;

    void ensureClientOrgForCrmClientAction({ accountId, clientId })
      .then((result) => {
        if (result?.clientOrgId) {
          setResolvedClientOrgId(result.clientOrgId);
        }
      })
      .catch(() => {
        /* support link stays hidden until org can be resolved */
      });
  }, [
    accountId,
    canEditClients,
    clientId,
    resolvedClientOrgId,
    supportEnabled,
  ]);

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
        if (data?.client_org_id) {
          setResolvedClientOrgId(data.client_org_id);
        }
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
      } catch (e) {
        if (!silent) {
          toast.error(e instanceof Error ? e.message : 'Failed to load client');
          setClient(null);
          setOverviewClientNotes([]);
          setOverviewMeetings([]);
          setOverviewBookings([]);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [accountId, clientId],
  );

  useEffect(() => {
    if (hasServerSeed) {
      return;
    }

    void fetchClient();
  }, [fetchClient, hasServerSeed]);

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

    if (isCommercial) {
      return (
        [
          ['overview', 'Details'],
          ...(client.client_type === 'business'
            ? [['contacts', 'Contacts']]
            : []),
          ['tasks', 'Tasks'],
          ['notes', 'Comments'],
          ['disposals', 'Disposals'],
          ['requirements', 'Requirements'],
          ['viewings', 'Viewings'],
          ['leases', 'Leases'],
          ['sales', 'Sales'],
        ] as Array<[DetailTab, string]>
      ).map(([key, label]) => ({
        key,
        label,
        meta: undefined as string | undefined,
      }));
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
        ...(supportEnabled ? [['support', 'Support']] : []),
      ] as Array<[DetailTab, string]>
    ).map(([key, label]) => ({
      key,
      label,
      meta: key === 'projects' ? String(jobsCount) : undefined,
    }));
  }, [client, isCommercial, isContractorView, jobsCount, supportEnabled]);

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await deleteClient({ accountId, clientId });
      toast.success('Client archived');
      setArchiveDialogOpen(false);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to archive client');
    } finally {
      setArchiving(false);
    }
  };

  const handleViewAsClient = () => {
    if (portalHref) {
      window.open(portalHref, '_blank', 'noopener,noreferrer');
      return;
    }

    const brandSettingsHref = pathsConfig.app.accountBrandSettings.replace(
      '[account]',
      accountSlug,
    );

    toast.error('Set a client portal slug in Brand settings first.', {
      action: {
        label: 'Open Brand',
        onClick: () => {
          window.location.href = brandSettingsHref;
        },
      },
    });
  };

  const handleInviteToPortal = async () => {
    if (!canEditClients) return;

    try {
      const result = (await listContacts({ accountId, clientId })) as {
        data?: Array<{
          id: string;
          email: string | null;
          emails?: Array<{ email: string; is_primary: boolean }>;
        }>;
      };
      const contacts = Array.isArray(result?.data) ? result.data : [];
      const withEmail = contacts.filter((contact) => {
        const fromList =
          contact.emails?.find((address) => address.is_primary)?.email ??
          contact.emails?.[0]?.email;
        const raw = (fromList ?? contact.email ?? '').trim();
        return raw.includes('@');
      });

      if (withEmail.length === 0) {
        setActiveTab('contacts');
        toast.error(
          'Add contacts with email addresses first, then invite them to the portal.',
        );
        return;
      }

      const inviteResult = await inviteAllContactsToPortalAction({
        accountId,
        accountSlug,
        clientId,
        contacts: withEmail.map((contact) => ({
          id: contact.id,
          email: contact.email,
          emails: contact.emails?.map((address) => ({
            email: address.email,
            is_primary: address.is_primary,
          })),
        })),
      });

      if (inviteResult.invited > 0) {
        toast.success(
          `Sent ${inviteResult.invited} portal invite${inviteResult.invited === 1 ? '' : 's'}`,
        );
        setActiveTab('contacts');
      } else if (inviteResult.failures.length > 0) {
        toast.error('Could not send portal invites');
      } else {
        toast.message('No contacts left to invite');
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to send portal invitations',
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
  const subtitle = isCommercial
    ? [client.commercial_role, client.company_name ?? client.city]
        .filter(Boolean)
        .join(' · ') || null
    : (client.company_name ?? client.city ?? null);
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

    if (activeTab === 'overview' && isCommercial) {
      return (
        <div className="space-y-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {canEditClients ? (
              <ClientImageUploader
                accountId={accountId}
                clientId={client.id}
                displayName={displayName}
                pictureUrl={client.picture_url}
                email={client.email}
                website={client.website}
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

            <div className="min-w-0 flex-1 space-y-3">
              {client.commercial_role ? (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  {client.commercial_role}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <OverviewMetric
                  icon={Building2}
                  label="Disposals"
                  value={String(commercialMetrics.disposals)}
                />
                <OverviewMetric
                  icon={Building2}
                  label="Requirements"
                  value={String(commercialMetrics.requirements)}
                />
                <OverviewMetric
                  icon={Calendar}
                  label="Viewings"
                  value={String(commercialMetrics.viewings)}
                />
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                {client.email ? (
                  <div>
                    <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Email
                    </dt>
                    <dd className="text-sm text-[var(--workspace-shell-text)]">
                      {client.email}
                    </dd>
                  </div>
                ) : null}
                {client.phone ? (
                  <div>
                    <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Phone
                    </dt>
                    <dd className="text-sm text-[var(--workspace-shell-text)]">
                      {client.phone}
                    </dd>
                  </div>
                ) : null}
                {address ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Address
                    </dt>
                    <dd className="text-sm text-[var(--workspace-shell-text)]">
                      {address}
                    </dd>
                  </div>
                ) : null}
                {client.website ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
                      Website
                    </dt>
                    <dd className="text-sm text-[var(--workspace-shell-text)]">
                      <a
                        href={websiteHref(client.website) ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--ozer-info)] hover:text-[var(--ozer-accent-muted)]"
                      >
                        {client.website}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>

              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Contact since {formatCreatedDate(client.created_at)} ·{' '}
                {formatLastUpdated(client.updated_at)}
              </p>
            </div>
          </div>
        </div>
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
                  email={client.email}
                  website={client.website}
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
                    value={formatMoney(totalValuePence)}
                  />
                </div>

                <div className="mt-4 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                        Retainers
                      </p>
                      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                        Recurring billing via Stripe Connect. Cancel + recreate
                        to change price.
                      </p>
                    </div>
                    <AttachRetainerPlanButton
                      accountId={accountId}
                      clientId={client.id}
                      canEdit={canEditClients}
                    />
                  </div>
                  <ClientSubscriptionStatusList
                    accountId={accountId}
                    clientId={client.id}
                    canEdit={canEditClients}
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
                {client.website ? (
                  <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                    <Globe className="mr-1.5 inline h-4 w-4 align-text-bottom" />
                    <a
                      href={websiteHref(client.website) ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[var(--ozer-accent-muted)] hover:underline"
                    >
                      {client.website.replace(/^https?:\/\//i, '')}
                    </a>
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
                  {jobsCount} total · {formatMoney(totalValuePence)}
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
            {canEditClients ? (
              <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 text-sm">
                <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  Portal access
                </p>
                <p className="mt-1 text-[var(--workspace-shell-text)]">
                  Invite contacts from the Contacts tab so each person gets
                  their own portal login.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3 border-[color:var(--workspace-shell-border)] bg-transparent"
                  onClick={() => setActiveTab('contacts')}
                >
                  Open contacts
                </Button>
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
          accountSlug={accountSlug}
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
            inviteeName={displayName}
            inviteeEmail={client.email}
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
          <ClientMediaRollup
            accountId={accountId}
            accountSlug={accountSlug}
            clientId={client.id}
          />
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

    if (activeTab === 'support' && supportEnabled) {
      return (
        <ClientSupportBlock
          accountSlug={accountSlug}
          accountId={accountId}
          clientOrgId={resolvedClientOrgId}
          clientId={client.id}
          canManageLinks={canEditClients}
        />
      );
    }

    if (isCommercial && activeTab === 'disposals') {
      return (
        <ClientDisposalsBlock
          accountSlug={accountSlug}
          accountId={accountId}
          clientId={client.id}
          canEdit={canEditClients}
        />
      );
    }

    if (isCommercial && activeTab === 'requirements') {
      return (
        <ClientRequirementsBlock
          accountSlug={accountSlug}
          accountId={accountId}
          clientId={client.id}
          canEdit={canEditClients}
        />
      );
    }

    if (isCommercial && activeTab === 'viewings') {
      return (
        <ClientViewingsBlock
          accountSlug={accountSlug}
          accountId={accountId}
          clientId={client.id}
          canEdit={canEditClients}
        />
      );
    }

    if (isCommercial && activeTab === 'leases') {
      return (
        <ClientLeasesBlock
          accountSlug={accountSlug}
          accountId={accountId}
          clientId={client.id}
          canEdit={canEditClients}
        />
      );
    }

    if (isCommercial && activeTab === 'sales') {
      return (
        <ClientSalesBlock
          accountSlug={accountSlug}
          accountId={accountId}
          clientId={client.id}
          canEdit={canEditClients}
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
            accountSlug={accountSlug}
            mode="edit"
            client={client}
            canEdit={canEditClients}
            showCommercialRole={showCommercialRole}
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
                  {client.website ? (
                    <a
                      href={websiteHref(client.website) ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] transition hover:border-[var(--ozer-accent)]/40 hover:text-[var(--ozer-accent-muted)]"
                      aria-label="Open website"
                    >
                      <Globe className="h-4 w-4" />
                    </a>
                  ) : null}
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
                        onClick={() => setArchiveDialogOpen(true)}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                      {!isCommercial ? (
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                          onClick={handleViewAsClient}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View as client
                        </DropdownMenuItem>
                      ) : null}
                      {!isCommercial && canEditClients ? (
                        <>
                          <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
                          <DropdownMenuItem
                            className="cursor-pointer focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                            onClick={() => void handleInviteToPortal()}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Invite contacts to portal
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <AlertDialog
                    open={archiveDialogOpen}
                    onOpenChange={setArchiveDialogOpen}
                  >
                    <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Archive this {isCommercial ? 'contact' : 'client'}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {isCommercial
                            ? 'They will be hidden from your contacts list, but linked disposals, requirements, viewings and notes are kept. You can restore them anytime from the Archived view.'
                            : 'They will be hidden from your client list, but all of their projects, invoices, notes and contacts are kept. You can restore them anytime from the Archived view on the Clients page.'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2 sm:gap-0">
                        <AlertDialogCancel className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]">
                          Cancel
                        </AlertDialogCancel>
                        <Button
                          variant="destructive"
                          disabled={archiving}
                          onClick={handleArchive}
                        >
                          {archiving
                            ? 'Archiving...'
                            : isCommercial
                              ? 'Archive contact'
                              : 'Archive client'}
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                        'inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-left text-sm font-medium transition-colors',
                        activeTab === key
                          ? 'border-[var(--ozer-accent)] text-[var(--workspace-shell-text)]'
                          : 'border-transparent text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                      )}
                    >
                      {label}
                      {meta ? (
                        <span className="text-xs font-normal text-[var(--workspace-shell-text-muted)]">
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
