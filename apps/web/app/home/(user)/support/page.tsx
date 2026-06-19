import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { HomeLayoutPageHeader } from '../_components/home-page-header';
import { PlatformSupportTicketForm } from './_components/platform-support-ticket-form';
import { formatPlatformTicketNumber } from '~/lib/support/platform-support.types';

export const metadata = { title: 'Support' };

async function PlatformSupportPage() {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();

  const [{ data: memberships }, { data: tickets }] = await Promise.all([
    client
      .from('accounts_memberships')
      .select('account:accounts!inner(id, name, slug, is_personal_account)')
      .eq('user_id', user.id),
    client
      .from('platform_support_tickets')
      .select('id, ticket_number, subject, status, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const accountOptions = (memberships ?? [])
    .map((row) => {
      const account = row.account as {
        id: string;
        name: string | null;
        slug: string | null;
        is_personal_account: boolean;
      };
      if (account.is_personal_account) return null;
      return {
        id: account.id,
        label: account.name ?? account.slug ?? account.id,
      };
    })
    .filter(Boolean) as Array<{ id: string; label: string }>;

  return (
    <>
      <HomeLayoutPageHeader
        title="Support"
        description="Contact the Ozer team about billing, bugs, or product questions."
      />
      <PageBody className="mx-auto max-w-2xl space-y-8 py-6">
        <PlatformSupportTicketForm accountOptions={accountOptions} />

        {(tickets ?? []).length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Your tickets</h2>
            <ul className="divide-y rounded-lg border">
              {(tickets ?? []).map((ticket) => (
                <li key={ticket.id} className="px-4 py-3 text-sm">
                  <Link
                    className="font-medium hover:underline"
                    href={`/app/support/${ticket.id}`}
                  >
                    {formatPlatformTicketNumber(ticket.ticket_number as number)}{' '}
                    {ticket.subject}
                  </Link>
                  <p className="text-muted-foreground mt-1 text-xs capitalize">
                    {ticket.status} ·{' '}
                    {new Date(ticket.created_at as string).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageBody>
    </>
  );
}

export default withI18n(PlatformSupportPage);
