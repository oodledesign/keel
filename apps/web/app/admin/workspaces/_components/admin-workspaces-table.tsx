'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/enhanced-data-table';
import { Form, FormControl, FormField, FormItem } from '@kit/ui/form';
import { Input } from '@kit/ui/input';

import type { AdminWorkspaceRow } from '../_lib/load-admin-workspaces';

export function AdminWorkspacesTable(props: {
  rows: AdminWorkspaceRow[];
  page: number;
  pageSize: number;
  pageCount: number;
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <WorkspacesFilters query={props.query} />
      <div className="rounded-lg border p-2">
        <DataTable
          data={props.rows}
          columns={columns}
          pageIndex={props.page - 1}
          pageSize={props.pageSize}
          pageCount={props.pageCount}
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

function WorkspacesFilters(props: { query: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const form = useForm({
    resolver: zodResolver(z.object({ query: z.string().optional() })),
    defaultValues: { query: props.query },
  });

  return (
    <Form {...form}>
      <form
        className="flex justify-end gap-2"
        onSubmit={form.handleSubmit((values) => {
          const params = new URLSearchParams();
          if (values.query) params.set('query', values.query);
          router.push(`${pathname}?${params.toString()}`);
        })}
      >
        <FormField
          name="query"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  placeholder="Search name, slug, or email…"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit">Search</Button>
      </form>
    </Form>
  );
}

const columns: ColumnDef<AdminWorkspaceRow>[] = [
  {
    header: 'Workspace',
    cell: ({ row }) => (
      <div>
        <Link
          className="font-medium hover:underline"
          href={`/admin/workspaces/${row.original.id}`}
        >
          {row.original.name}
        </Link>
        <p className="text-muted-foreground text-xs">{row.original.slug}</p>
      </div>
    ),
  },
  {
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.workspaceLabel}</Badge>
    ),
  },
  {
    header: 'Owner',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {row.original.ownerEmail ?? '—'}
      </span>
    ),
  },
  {
    header: 'Billing',
    cell: ({ row }) => {
      if (row.original.billingExempt) {
        return <Badge variant="secondary">Exempt</Badge>;
      }
      const status = row.original.subscriptionStatus;
      if (!status) {
        return <Badge variant="destructive">None</Badge>;
      }
      return (
        <Badge variant="outline" className="capitalize">
          {status}
        </Badge>
      );
    },
  },
  {
    header: 'Entitlements',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {row.original.entitlements.length
          ? row.original.entitlements.join(', ')
          : '—'}
      </span>
    ),
  },
  {
    header: 'Created',
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString('en-GB'),
  },
];
