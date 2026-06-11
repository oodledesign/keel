import { notFound } from 'next/navigation';

import { AdminGuard } from '@kit/admin/components/admin-guard';

import { loadAdminPlatformSupportTicket } from '~/lib/support/load-platform-support-ticket';

import { AdminPlatformSupportTicketDetail } from './_components/admin-platform-support-ticket-detail';

interface AdminSupportTicketPageProps {
  params: Promise<{ id: string }>;
}

async function AdminSupportTicketPage({ params }: AdminSupportTicketPageProps) {
  const { id } = await params;
  const ticket = await loadAdminPlatformSupportTicket(id);

  if (!ticket) {
    notFound();
  }

  return <AdminPlatformSupportTicketDetail ticket={ticket} />;
}

export default AdminGuard(AdminSupportTicketPage);
