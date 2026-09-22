'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Layers, MoreHorizontal, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';

import pathsConfig from '~/config/paths.config';

import type {
  PortalRequestDraft,
  PortalTicketStatus,
} from '../_lib/schema/portal.schema';
import type { PortalTicket } from '../_lib/server/client-portal.service';
import {
  PortalTicketPriorityBadge,
  PortalTicketStatusBadge,
  formatPortalDate,
  formatPortalTicketNumber,
} from './portal-badges';
import { PortalServicesTabs } from './portal-services-tabs';
import { PortalSupportNewForm } from './portal-support-content';

type StatusFilter = 'all' | PortalTicketStatus;
type RequestIntent = 'service' | 'support';

const statusTabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'pending_credits', label: 'Pending credits' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

type RequestTypeOption = {
  id: string;
  label: string;
  creditCost: number;
  isBillable: boolean;
  isSupport?: boolean;
  categoryGroup: string | null;
};

type EffectiveServiceOption = RequestTypeOption & {
  categorySortOrder?: number;
  requestTypeId?: string | null;
};

export function PortalSupportListContent({
  clientSlug,
  clientOrgId,
  accountId,
  accountSlug,
  initialTickets,
  canRequest = false,
  initialBalance = 0,
  initialRequestTypes = [],
  initialEffectiveServices = [],
  initialProjects = [],
  initialDraft = null,
  initialRequest = null,
}: {
  clientSlug: string;
  clientOrgId: string;
  accountId: string;
  accountSlug: string;
  initialTickets: PortalTicket[];
  canRequest?: boolean;
  initialBalance?: number;
  initialRequestTypes?: RequestTypeOption[];
  initialEffectiveServices?: EffectiveServiceOption[];
  initialProjects?: Array<{ id: string; name: string }>;
  initialDraft?: PortalRequestDraft | null;
  initialRequest?: string | null;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [draft, setDraft] = useState<PortalRequestDraft | null>(initialDraft);
  const initialLaunchIntent: RequestIntent | null =
    initialRequest === 'support'
      ? 'support'
      : initialRequest === 'service' || initialRequest === '1'
        ? 'service'
        : null;
  const shouldOpenFromQuery =
    Boolean(initialLaunchIntent) || initialRequest === 'new';
  const [open, setOpen] = useState(shouldOpenFromQuery);
  const [launchIntent, setLaunchIntent] = useState<RequestIntent | null>(
    initialLaunchIntent,
  );
  const [formKey, setFormKey] = useState(0);

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return initialTickets;
    return initialTickets.filter((ticket) => ticket.status === statusFilter);
  }, [initialTickets, statusFilter]);

  const servicesHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
  );
  const settingsHref = pathsConfig.app.clientPortalSettings.replace(
    '[clientSlug]',
    clientSlug,
  );
  const billingHref = pathsConfig.app.clientPortalBilling.replace(
    '[clientSlug]',
    clientSlug,
  );

  function openRequest(intent: RequestIntent | null) {
    setLaunchIntent(intent);
    setFormKey((current) => current + 1);
    setOpen(true);
  }

  function closeRequest() {
    setOpen(false);
    if (initialRequest) {
      router.replace(servicesHref);
    }
  }

  const primaryLabel = canRequest ? 'Request service' : 'New request';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[var(--ozer-text-on-light)]">
            Services
          </h2>
          <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
            {filteredTickets.length}{' '}
            {filteredTickets.length === 1 ? 'request' : 'requests'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            data-test="portal-request-service"
            onClick={() => openRequest(canRequest ? 'service' : null)}
          >
            {canRequest ? null : <Plus className="h-4 w-4" />}
            {primaryLabel}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="More actions"
                data-test="portal-services-more"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openRequest('support')}>
                Support ticket
              </DropdownMenuItem>
              {draft ? (
                <DropdownMenuItem onSelect={() => openRequest(null)}>
                  Resume draft
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link href={settingsHref}>Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={billingHref}>Billing</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {draft ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2.5">
          <p className="text-sm text-[var(--workspace-shell-text)]">
            You have an unfinished request.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openRequest(null)}
          >
            Resume
          </Button>
        </div>
      ) : null}

      <PortalServicesTabs clientSlug={clientSlug} active="requests" />

      <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
                  : 'text-[var(--ozer-text-on-light-muted)] hover:bg-slate-100 hover:text-[var(--ozer-text-on-light)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="mb-4 h-12 w-12 text-[var(--workspace-shell-text-muted)]" />
            <p className="font-medium text-[var(--ozer-text-on-light)]">
              No requests yet
            </p>
            <p className="mt-1 max-w-md text-sm text-[var(--ozer-text-on-light-muted)]">
              Request a service or open a support ticket and our team will get
              back to you.
            </p>
            <Button
              type="button"
              className="mt-4"
              onClick={() => openRequest(canRequest ? 'service' : null)}
            >
              {primaryLabel}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Request</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => {
                  const detailHref = pathsConfig.app.clientPortalSupportDetail
                    .replace('[clientSlug]', clientSlug)
                    .replace('[id]', ticket.id);

                  return (
                    <tr
                      key={ticket.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        <Link
                          href={detailHref}
                          className="hover:text-[var(--ozer-accent)]"
                        >
                          {formatPortalTicketNumber(ticket.ticketNumber)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={detailHref}
                          className="font-medium text-[var(--ozer-text-on-light)] hover:text-[var(--ozer-accent)]"
                        >
                          {ticket.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <PortalTicketStatusBadge status={ticket.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PortalTicketPriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatPortalDate(ticket.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : closeRequest())}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {draft
                ? 'Resume request'
                : launchIntent === 'support'
                  ? 'Support ticket'
                  : 'Request service'}
            </DialogTitle>
            <DialogDescription>
              Choose a service or open a support ticket. You can save a draft
              and come back later.
            </DialogDescription>
          </DialogHeader>
          {open ? (
            <PortalSupportNewForm
              key={formKey}
              presentation="embedded"
              clientOrgId={clientOrgId}
              accountId={accountId}
              accountSlug={accountSlug}
              clientSlug={clientSlug}
              initialBalance={initialBalance}
              initialRequestTypes={initialRequestTypes}
              initialEffectiveServices={initialEffectiveServices}
              initialProjects={initialProjects}
              initialDraft={draft}
              initialIntent={draft ? null : launchIntent}
              onClose={closeRequest}
              onDraftChange={setDraft}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
