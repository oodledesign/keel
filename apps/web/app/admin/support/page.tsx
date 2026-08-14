import { AdminGuard } from '@kit/admin/components/admin-guard';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { PageBody, PageHeader } from '@kit/ui/page';

import {
  type AdminSupportTicketRow,
  AdminSupportTicketsTable,
} from './_components/admin-support-tickets-table';

export const metadata = { title: 'Platform support' };

async function AdminSupportPage() {
  // AdminGuard already verified super-admin; use service role so listing
  // does not depend on RLS edge cases for is_super_admin().
  const client = getSupabaseServerAdminClient();

  const { data: tickets, error } = await (
    client.from('platform_support_tickets') as any
  )
    .select(
      'id, ticket_number, subject, status, priority, category, created_at, user_id',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[admin/support] failed to load tickets', error.message);
  }

  const rows = ((tickets ?? []) as AdminSupportTicketRow[]).map((ticket) => ({
    ...ticket,
    ticket_number: Number(ticket.ticket_number ?? 0),
    subject: ticket.subject || 'Support request',
    status: ticket.status || 'open',
    priority: ticket.priority || 'normal',
    category: ticket.category ?? 'question',
    created_at: ticket.created_at || new Date(0).toISOString(),
    user_id: ticket.user_id || '',
  }));

  return (
    <>
      <PageHeader
        title="Platform support"
        description="Platform support tickets from Ozer users"
      />
      <PageBody className="max-w-4xl py-4">
        {error ? (
          <p className="text-destructive mb-4 text-sm">
            Could not load tickets: {error.message}
          </p>
        ) : null}
        <AdminSupportTicketsTable tickets={rows} />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminSupportPage);
