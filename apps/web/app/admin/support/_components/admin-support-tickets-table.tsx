'use client';

import Link from 'next/link';

import { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/enhanced-data-table';

import {
  formatPlatformSupportCategory,
  formatPlatformTicketNumber,
} from '~/lib/support/platform-support.types';

export type AdminSupportTicketRow = {
  id: string;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  category?: string | null;
  created_at: string;
  user_id: string;
};

export function AdminSupportTicketsTable({
  tickets,
}: {
  tickets: AdminSupportTicketRow[];
}) {
  if (tickets.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No platform support tickets.
      </p>
    );
  }

  return (
    <div className="rounded-lg border p-2">
      <DataTable
        data={tickets}
        columns={columns}
        pageSize={Math.max(tickets.length, 1)}
        pageCount={1}
        pageIndex={0}
        getRowId={(row) => row.id}
      />
    </div>
  );
}

const columns: ColumnDef<AdminSupportTicketRow>[] = [
  {
    id: 'ticket',
    header: 'Ticket',
    cell: ({ row }) => (
      <div>
        <Link
          className="font-medium hover:underline"
          href={`/admin/support/${row.original.id}`}
        >
          {formatPlatformTicketNumber(row.original.ticket_number)}{' '}
          {row.original.subject}
        </Link>
      </div>
    ),
  },
  {
    id: 'category',
    header: 'Category',
    cell: ({ row }) => (
      <Badge variant="secondary">
        {formatPlatformSupportCategory(row.original.category)}
      </Badge>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {(row.original.status || 'open').replace(/_/g, ' ')}
      </Badge>
    ),
  },
  {
    id: 'priority',
    header: 'Priority',
    cell: ({ row }) => (
      <Badge variant="secondary" className="capitalize">
        {row.original.priority || 'normal'}
      </Badge>
    ),
  },
  {
    id: 'created',
    header: 'Created',
    cell: ({ row }) =>
      new Date(row.original.created_at).toLocaleString('en-GB'),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/support/${row.original.id}`}>Open</Link>
      </Button>
    ),
  },
];
