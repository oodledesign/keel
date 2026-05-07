import Link from 'next/link';

import { Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import pathsConfig from '~/config/paths.config';

import type { SignatureStaff } from '../_lib/server/signatures-data';
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
  accountSlug,
  staff,
  compact = false,
}: {
  accountSlug: string;
  staff: SignatureStaff[];
  compact?: boolean;
}) {
  if (!staff.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/10 p-8 text-sm text-muted-foreground">
        No staff synced yet. Connect Microsoft 365, then sync staff from M365.
      </div>
    );
  }

  const visibleStaff = compact ? staff.slice(0, 8) : staff;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)]">
      <Table>
        <TableHeader className="bg-black/20">
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="px-4 py-3">Name</TableHead>
            <TableHead className="px-4 py-3">Job Title</TableHead>
            <TableHead className="px-4 py-3">Branch</TableHead>
            <TableHead className="px-4 py-3">Template</TableHead>
            <TableHead className="px-4 py-3">Status</TableHead>
            <TableHead className="px-4 py-3">Last Pushed</TableHead>
            <TableHead className="px-4 py-3 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleStaff.map((row) => {
            const detailPath = pathsConfig.app.accountSignaturesStaffDetail
              .replace('[account]', accountSlug)
              .replace('[staffId]', row.id);

            return (
              <TableRow key={row.id} className="border-white/5">
                <TableCell className="px-4 py-3">
                  <div className="font-medium text-white">
                    {row.full_name || row.email}
                  </div>
                  <div className="text-xs text-muted-foreground">{row.email}</div>
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {row.job_title || '-'}
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {row.branch || '-'}
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {row.template_name || 'Unassigned'}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <SignaturesStatusBadge status={row.signature_status} />
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {formatDate(row.signature_pushed_at)}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={detailPath}>
                      <Send className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
