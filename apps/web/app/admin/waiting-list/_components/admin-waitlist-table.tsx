'use client';

import { useState, useTransition } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { ColumnDef } from '@tanstack/react-table';
import { Download, Mail, Search, Trash2 } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/enhanced-data-table';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import type { AdminWaitlistLead } from '../_lib/load-admin-waitlist';
import { deleteWaitlistLeadAction } from '../_lib/waitlist.actions';

export function AdminWaitlistTable(props: {
  leads: AdminWaitlistLead[];
  page: number;
  perPage: number;
  total: number;
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(props.query);
  const [, startTransition] = useTransition();

  const pageCount = Math.max(1, Math.ceil(props.total / props.perPage));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set('query', search.trim());
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleExportCsv = () => {
    if (props.leads.length === 0) {
      toast.error('No leads to export');
      return;
    }
    const headers = ['Email', 'Source', 'Interests', 'Created At'];
    const rows = props.leads.map((l) => [
      `"${l.email}"`,
      `"${l.source}"`,
      `"${l.interests.join(', ')}"`,
      `"${l.createdAt}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `ozer-waiting-list-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<AdminWaitlistLead>[] = [
    {
      accessorKey: 'email',
      header: 'Work email',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="text-foreground font-semibold">
            {row.original.email}
          </span>
          <a
            href={`mailto:${row.original.email}?subject=Welcome%20to%20Ozer`}
            className="text-muted-foreground hover:text-foreground"
            title="Send email"
          >
            <Mail className="size-3.5" />
          </a>
        </div>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs font-medium">
          {row.original.source}
        </Badge>
      ),
    },
    {
      accessorKey: 'interests',
      header: 'Interests',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.interests.map((interest) => (
            <Badge key={interest} variant="secondary" className="text-[11px]">
              {interest}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Signed up',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {new Date(row.original.createdAt).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive size-7"
            title="Delete entry"
            onClick={() => {
              if (
                confirm(`Remove ${row.original.email} from the waiting list?`)
              ) {
                startTransition(async () => {
                  try {
                    await deleteWaitlistLeadAction({ id: row.original.id });
                    toast.success('Removed lead');
                    router.refresh();
                  } catch {
                    toast.error('Could not remove lead');
                  }
                });
              }
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          onSubmit={handleSearch}
          className="flex max-w-sm flex-1 items-center gap-2"
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email..."
            className="h-9 text-sm"
          />
          <Button type="submit" variant="secondary" size="sm" className="h-9">
            <Search className="mr-1 size-3.5" />
            Search
          </Button>
        </form>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="h-9"
        >
          <Download className="mr-1.5 size-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border p-2">
        <DataTable
          data={props.leads}
          columns={columns}
          pageIndex={props.page - 1}
          pageSize={props.perPage}
          pageCount={pageCount}
          onPaginationChange={(pagination) => {
            const params = new URLSearchParams();
            if (props.query) params.set('query', props.query);
            params.set('page', String(pagination.pageIndex + 1));
            router.push(`${pathname}?${params.toString()}`);
          }}
        />
      </div>
    </div>
  );
}
