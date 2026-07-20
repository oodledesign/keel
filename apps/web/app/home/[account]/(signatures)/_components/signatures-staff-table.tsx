'use client';

import { useState } from 'react';

import Link from 'next/link';

import { AlertTriangle, Loader2, Mail, Pencil } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import pathsConfig from '~/config/paths.config';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { staffSourceLabel } from '~/lib/signatures/staff-source';

import type { SignatureStaff } from '../_lib/server/signatures-data';
import { sendSignatureInstallInstructionsAction } from '../_lib/server/signatures-module-actions';
import { SignaturesStaffTablePagination } from './signatures-staff-table-pagination';
import { SignaturesStatusBadge } from './signatures-status-badge';

function formatDate(value: string | null) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function SignaturesStaffTable({
  accountId,
  accountSlug,
  staff,
  openRequestCounts = {},
  page,
  pageSize,
  totalCount,
  paginationPageSizes,
  emptyMessage = 'No staff yet. Sync from Microsoft 365 or Google Workspace, add people manually, or import a CSV from the toolbar above.',
}: {
  accountId: string;
  accountSlug: string;
  staff: SignatureStaff[];
  openRequestCounts?: Record<string, number>;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  paginationPageSizes?: readonly number[];
  emptyMessage?: string;
}) {
  const [emailingId, setEmailingId] = useState<string | null>(null);

  if (!staff.length) {
    return (
      <div className="text-muted-foreground rounded-2xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-8 text-sm">
        {emptyMessage}
      </div>
    );
  }

  const showPagination =
    page != null && pageSize != null && totalCount != null && totalCount > 0;

  const emailInstall = async (row: SignatureStaff) => {
    if (!row.template_id) {
      toast.error('Assign a template before sending install instructions');
      return;
    }

    setEmailingId(row.id);
    try {
      const result = await sendSignatureInstallInstructionsAction({
        accountId,
        staffId: row.id,
        templateId: row.template_id,
      });
      toast.success(`Install email sent to ${result.to}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setEmailingId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <Table>
        <TableHeader className="bg-[var(--workspace-shell-sidebar-accent)]">
          <TableRow className="border-[color:var(--workspace-shell-border)] hover:bg-transparent">
            <TableHead className="px-4 py-3">Name</TableHead>
            <TableHead className="px-4 py-3">Job Title</TableHead>
            <TableHead className="px-4 py-3">Branch</TableHead>
            <TableHead className="px-4 py-3">Template</TableHead>
            <TableHead className="px-4 py-3">Status</TableHead>
            <TableHead className="px-4 py-3">Requests</TableHead>
            <TableHead className="px-4 py-3">Last Pushed</TableHead>
            <TableHead className="px-4 py-3 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((row) => {
            const detailPath = pathsConfig.app.accountSignaturesStaffDetail
              .replace('[account]', accountSlug)
              .replace('[staffId]', row.id);
            const requestCount = openRequestCounts[row.id] ?? 0;
            const requestsPath = `${pathsConfig.app.accountSignaturesRequests.replace('[account]', accountSlug)}#staff-${row.id}`;

            return (
              <TableRow
                key={row.id}
                className="border-[color:var(--workspace-shell-border)]"
              >
                <TableCell className="px-4 py-3">
                  <div className="font-medium text-[var(--workspace-shell-text)]">
                    {row.full_name || row.email}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {row.email}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[11px]">
                    {staffSourceLabel(row.source)}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground px-4 py-3">
                  {row.job_title || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground px-4 py-3">
                  {row.branch || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground px-4 py-3">
                  {row.template_name || 'Unassigned'}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <SignaturesStatusBadge status={row.signature_status} />
                </TableCell>
                <TableCell className="px-4 py-3">
                  {requestCount > 0 ? (
                    <Link
                      href={requestsPath}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-200"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {requestCount} open
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground px-4 py-3">
                  {formatDate(row.signature_pushed_at)}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.template_id ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={emailingId === row.id}
                        onClick={() => void emailInstall(row)}
                      >
                        {emailingId === row.id ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="mr-2 h-3.5 w-3.5" />
                        )}
                        Email install
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="outline">
                      <Link href={detailPath}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {showPagination ? (
        <SignaturesStaffTablePagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          pageSizes={paginationPageSizes}
        />
      ) : null}
    </div>
  );
}
