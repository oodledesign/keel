'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Badge } from '@kit/ui/badge';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import { formatUkDateTimeMedium } from '~/lib/format/uk-datetime';

import type {
  GroupedEmailLogCampaignRow,
  PlatformEmailLogRow,
} from '../_lib/server/admin-email-log.loader';

const FILTER_ALL = '__email_log_filter_all__';

function formatEmailType(type: string) {
  return type.replace(/_/g, ' ');
}

export function EmailLogTable({
  rows,
  groupedCampaigns,
  total,
  currentPage,
  pageSize,
  emailTypes,
  businesses,
  currentEmailType,
  currentAccountId,
  currentQuery,
}: {
  rows: PlatformEmailLogRow[];
  groupedCampaigns: GroupedEmailLogCampaignRow[];
  total: number;
  currentPage: number;
  pageSize: number;
  emailTypes: Array<{ value: string; label: string }>;
  businesses: Array<{ id: string; name: string | null; slug: string | null }>;
  currentEmailType: string;
  currentAccountId: string;
  currentQuery: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<'grouped' | 'individual'>('grouped');
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const transactionalRows = useMemo(
    () => rows.filter((row) => row.email_type !== 'campaign'),
    [rows],
  );

  useEffect(() => {
    const saved = window.localStorage.getItem('admin-email-log-view');
    if (saved === 'individual' || saved === 'grouped') {
      setView(saved);
    }
  }, []);

  const updateView = (next: 'grouped' | 'individual') => {
    setView(next);
    window.localStorage.setItem('admin-email-log-view', next);
  };

  const pushFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams();

    const next = {
      type: currentEmailType,
      account: currentAccountId,
      query: currentQuery,
      page: String(currentPage),
      ...updates,
    };

    if (next.type) params.set('type', next.type);
    if (next.account) params.set('account', next.account);
    if (next.query) params.set('query', next.query);
    if (next.page && next.page !== '1') params.set('page', next.page);

    router.push(`/admin/email-log?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex w-fit rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1">
        <button
          type="button"
          onClick={() => updateView('grouped')}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            view === 'grouped'
              ? 'bg-[#57C87F] text-[#09111F]'
              : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)]'
          }`}
        >
          Grouped view
        </button>
        <button
          type="button"
          onClick={() => updateView('individual')}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            view === 'individual'
              ? 'bg-[#57C87F] text-[#09111F]'
              : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)]'
          }`}
        >
          Individual view
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select
            value={currentEmailType || FILTER_ALL}
            onValueChange={(value) =>
              pushFilters({
                type: value === FILTER_ALL ? undefined : value,
                page: '1',
              })
            }
          >
            <SelectTrigger className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] sm:w-[200px]">
              <SelectValue placeholder="Email type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All types</SelectItem>
              {emailTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentAccountId || FILTER_ALL}
            onValueChange={(value) =>
              pushFilters({
                account: value === FILTER_ALL ? undefined : value,
                page: '1',
              })
            }
          >
            <SelectTrigger className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] sm:w-[240px]">
              <SelectValue placeholder="Business" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All businesses</SelectItem>
              {businesses.map((business) => (
                <SelectItem key={business.id} value={business.id}>
                  {business.name ?? business.slug ?? business.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          placeholder="Search recipient or subject…"
          defaultValue={currentQuery}
          className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] lg:max-w-sm"
          onChange={(event) => {
            const value = event.target.value.trim();
            pushFilters({
              query: value || undefined,
              page: '1',
            });
          }}
        />
      </div>

      {view === 'grouped' ? (
        <GroupedEmailLogTable
          campaigns={groupedCampaigns}
          transactionalRows={transactionalRows}
        />
      ) : (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <Table>
            <TableHeader>
              <TableRow className="border-[color:var(--workspace-shell-border)] hover:bg-transparent">
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Sent
                </TableHead>
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Type
                </TableHead>
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Business
                </TableHead>
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Recipient
                </TableHead>
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Subject
                </TableHead>
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-[color:var(--workspace-shell-border)]">
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-[var(--workspace-shell-text-muted)]"
                  >
                    No emails logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-[color:var(--workspace-shell-border)]"
                  >
                    <TableCell className="whitespace-nowrap text-[var(--workspace-shell-text-muted)]">
                      {formatUkDateTimeMedium(row.created_at)}
                    </TableCell>
                    <TableCell className="text-[var(--workspace-shell-text-muted)] capitalize">
                      {formatEmailType(row.email_type)}
                    </TableCell>
                    <TableCell className="text-[var(--workspace-shell-text-muted)]">
                      {row.account_name ? (
                        <div>
                          <p>{row.account_name}</p>
                          {row.account_slug ? (
                            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                              /{row.account_slug}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-[var(--workspace-shell-text-muted)]">
                      {row.recipient_email}
                    </TableCell>
                    <TableCell
                      className="max-w-xs truncate text-[var(--workspace-shell-text-muted)]"
                      title={row.subject}
                    >
                      {row.subject}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.status === 'sent'
                            ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                            : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                        }
                      >
                        {row.status}
                      </Badge>
                      {row.error_message ? (
                        <p
                          className="mt-1 max-w-xs truncate text-xs text-rose-300/80"
                          title={row.error_message}
                        >
                          {row.error_message}
                        </p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {view === 'individual' && pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-[var(--workspace-shell-text-muted)]">
          <span>
            Page {currentPage} of {pageCount} · {total} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              className="rounded-md border border-[color:var(--workspace-shell-border)] px-3 py-1 disabled:opacity-40"
              onClick={() => pushFilters({ page: String(currentPage - 1) })}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= pageCount}
              className="rounded-md border border-[color:var(--workspace-shell-border)] px-3 py-1 disabled:opacity-40"
              onClick={() => pushFilters({ page: String(currentPage + 1) })}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupedEmailLogTable({
  campaigns,
  transactionalRows,
}: {
  campaigns: GroupedEmailLogCampaignRow[];
  transactionalRows: PlatformEmailLogRow[];
}) {
  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <Table>
        <TableHeader>
          <TableRow className="border-[color:var(--workspace-shell-border)] hover:bg-transparent">
            <TableHead className="text-[var(--workspace-shell-text-muted)]">
              Date sent
            </TableHead>
            <TableHead className="text-[var(--workspace-shell-text-muted)]">
              Type
            </TableHead>
            <TableHead className="text-[var(--workspace-shell-text-muted)]">
              Campaign / Subject
            </TableHead>
            <TableHead className="text-[var(--workspace-shell-text-muted)]">
              Recipient list
            </TableHead>
            <TableHead className="text-[var(--workspace-shell-text-muted)]">
              Total sent
            </TableHead>
            <TableHead className="text-[var(--workspace-shell-text-muted)]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow
              key={`campaign-${campaign.id}`}
              className="border-[color:var(--workspace-shell-border)]"
            >
              <TableCell className="whitespace-nowrap text-[var(--workspace-shell-text-muted)]">
                {campaign.sent_at
                  ? formatUkDateTimeMedium(campaign.sent_at)
                  : '—'}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                >
                  Campaign
                </Badge>
              </TableCell>
              <TableCell className="font-medium text-[var(--workspace-shell-text)]">
                {campaign.title}
              </TableCell>
              <TableCell className="text-[var(--workspace-shell-text-muted)]">
                {campaign.recipient_list.replace(/_/g, ' ')}
              </TableCell>
              <TableCell className="text-[var(--workspace-shell-text-muted)]">
                {campaign.total_sent}
              </TableCell>
              <TableCell>
                <Link
                  href={`/admin/email-marketing/${campaign.id}`}
                  className="text-sm text-[#57C87F] hover:underline"
                >
                  View details
                </Link>
              </TableCell>
            </TableRow>
          ))}

          {transactionalRows.map((row) => (
            <TableRow
              key={`transactional-${row.id}`}
              className="border-[color:var(--workspace-shell-border)]"
            >
              <TableCell className="whitespace-nowrap text-[var(--workspace-shell-text-muted)]">
                {formatUkDateTimeMedium(row.created_at)}
              </TableCell>
              <TableCell className="text-[var(--workspace-shell-text-muted)] capitalize">
                {formatEmailType(row.email_type)}
              </TableCell>
              <TableCell
                className="max-w-xs truncate text-[var(--workspace-shell-text-muted)]"
                title={row.subject}
              >
                {row.subject}
              </TableCell>
              <TableCell className="text-[var(--workspace-shell-text-muted)]">
                —
              </TableCell>
              <TableCell className="text-[var(--workspace-shell-text-muted)]">
                1
              </TableCell>
              <TableCell className="text-[var(--workspace-shell-text-muted)]">
                —
              </TableCell>
            </TableRow>
          ))}

          {campaigns.length === 0 && transactionalRows.length === 0 ? (
            <TableRow className="border-[color:var(--workspace-shell-border)]">
              <TableCell
                colSpan={6}
                className="py-10 text-center text-[var(--workspace-shell-text-muted)]"
              >
                No emails logged yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
