'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { ColumnDef } from '@tanstack/react-table';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/enhanced-data-table';
import { Form, FormControl, FormField, FormItem } from '@kit/ui/form';
import { Input } from '@kit/ui/input';

import type { AdminUserRow } from '../_lib/load-admin-users';

const FiltersSchema = z.object({
  query: z.string().optional(),
});

export function AdminUsersTable(props: {
  users: AdminUserRow[];
  page: number;
  perPage: number;
  total: number;
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pageCount = Math.max(1, Math.ceil(props.total / props.perPage));

  return (
    <div className="space-y-4">
      <AdminUsersFilters query={props.query} />
      <div className="rounded-lg border p-2">
        <DataTable
          data={props.users}
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

function AdminUsersFilters(props: { query: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const form = useForm({
    resolver: zodResolver(FiltersSchema),
    defaultValues: { query: props.query },
  });

  const query = useWatch({ control: form.control, name: 'query' });

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
                <Input placeholder="Search email or user id…" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit">Search</Button>
        {query ? (
          <Button type="button" variant="outline" onClick={() => router.push(pathname)}>
            Clear
          </Button>
        ) : null}
      </form>
    </Form>
  );
}

const columns: ColumnDef<AdminUserRow>[] = [
  {
    id: 'email',
    header: 'Email',
    accessorKey: 'email',
    cell: ({ row }) => (
      <Link
        className="hover:underline"
        href={`/admin/accounts/${row.original.personalAccountId ?? row.original.id}`}
      >
        {row.original.email ?? '—'}
      </Link>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      if (row.original.isSuperAdmin) {
        return <Badge variant="outline">Super admin</Badge>;
      }
      if (row.original.banned) {
        return <Badge variant="destructive">Banned</Badge>;
      }
      return <Badge variant="secondary">Active</Badge>;
    },
  },
  {
    id: 'createdAt',
    header: 'Created',
    cell: ({ row }) =>
      new Date(row.original.createdAt).toLocaleDateString('en-GB'),
  },
  {
    id: 'lastSignInAt',
    header: 'Last sign-in',
    cell: ({ row }) =>
      row.original.lastSignInAt
        ? new Date(row.original.lastSignInAt).toLocaleString('en-GB')
        : '—',
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Button asChild variant="outline" size="sm">
        <Link
          href={`/admin/accounts/${row.original.personalAccountId ?? row.original.id}`}
        >
          View account
        </Link>
      </Button>
    ),
  },
];
