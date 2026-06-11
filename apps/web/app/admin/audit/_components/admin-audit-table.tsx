'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { ColumnDef } from '@tanstack/react-table';

import { DataTable } from '@kit/ui/enhanced-data-table';

import type { AdminAuditRow } from '../_lib/load-admin-audit-log';

export function AdminAuditTable(props: {
  rows: AdminAuditRow[];
  page: number;
  pageSize: number;
  pageCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="rounded-lg border p-2">
      <DataTable
        data={props.rows}
        columns={columns}
        pageIndex={props.page - 1}
        pageSize={props.pageSize}
        pageCount={props.pageCount}
        onPaginationChange={(pagination) => {
          const params = new URLSearchParams();
          params.set('page', String(pagination.pageIndex + 1));
          router.push(`${pathname}?${params.toString()}`);
        }}
      />
    </div>
  );
}

const columns: ColumnDef<AdminAuditRow>[] = [
  {
    header: 'When',
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleString('en-GB'),
  },
  {
    header: 'Action',
    accessorKey: 'action',
  },
  {
    header: 'Admin',
    cell: ({ row }) => row.original.actorEmail ?? row.original.actorUserId,
  },
  {
    header: 'Workspace',
    cell: ({ row }) => {
      if (!row.original.targetAccountId) return '—';
      return (
        <Link
          className="hover:underline"
          href={`/admin/accounts/${row.original.targetAccountId}`}
        >
          {row.original.targetAccountName ?? row.original.targetAccountId}
        </Link>
      );
    },
  },
  {
    header: 'Details',
    cell: ({ row }) => {
      const keys = Object.keys(row.original.metadata);
      if (!keys.length) return '—';
      return (
        <span className="text-muted-foreground font-mono text-xs">
          {JSON.stringify(row.original.metadata)}
        </span>
      );
    },
  },
];
