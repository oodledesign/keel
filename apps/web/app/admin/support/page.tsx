import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AdminSupportTicketsTable,
  type AdminSupportTicketRow,
} from './_components/admin-support-tickets-table';

export const metadata = { title: 'Platform support' };

async function AdminSupportPage() {
  const client = getSupabaseServerClient();

  const { data: tickets, error } = await client
    .from('platform_support_tickets')
    .select('id, ticket_number, subject, status, priority, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (
    <>
      <PageHeader description="Platform support tickets from Ozer users" />
      <PageBody className="max-w-4xl py-4">
        <AdminSupportTicketsTable
          tickets={(tickets ?? []) as AdminSupportTicketRow[]}
        />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminSupportPage);
