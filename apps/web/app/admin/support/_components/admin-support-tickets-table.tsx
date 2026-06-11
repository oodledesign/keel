'use client';

import Link from 'next/link';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@kit/ui/enhanced-data-table';

import { formatPlatformTicketNumber } from '~/lib/support/platform-support.types';

export type AdminSupportTicketRow = {
  id: string;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
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
      <p className="text-muted-foreground text-sm">No platform support tickets.</p>
    );
  }

  return (
    <div className="rounded-lg border p-2">
      <DataTable data={tickets} columns={columns} pageSize={25} />
    </div>
  );
}

const columns: ColumnDef<AdminSupportTicketRow>[] = [
  {
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
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.status.replace('_', ' ')}
      </Badge>
    ),
  },
  {
    header: 'Priority',
    cell: ({ row }) => (
      <Badge variant="secondary" className="capitalize">
        {row.original.priority}
      </Badge>
    ),
  },
  {
    header: 'Created',
    cell: ({ row }) =>
      new Date(row.original.created_at).toLocaleString('en-GB'),
  },
  {
    header: '',
    cell: ({ row }) => (
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/support/${row.original.id}`}>Open</Link>
      </Button>
    ),
  },
];
