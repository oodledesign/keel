import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PortalMessagesInbox } from '../_components/portal-messages-inbox';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createClientPortalService } from '../_lib/server/client-portal.service';

interface PortalMessagesPageProps {
  params: Promise<{ slug: string }>;
}

export const generateMetadata = async () => ({ title: 'Messages' });

export default async function PortalMessagesPage({
  params,
}: PortalMessagesPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());

  let threads = await service.listParticipatingThreads(ctx.clientOrgId);
  if (threads.length === 0) {
    const threadId = await service.getOrCreateMessageThread(ctx.clientOrgId);
    threads = await service.listParticipatingThreads(ctx.clientOrgId);
    if (threads.length === 0) {
      threads = [
        {
          id: threadId,
          title: 'Everyone on this client',
          lastMessagePreview: null,
          lastMessageAt: new Date().toISOString(),
          isClientWide: true,
        },
      ];
    }
  }

  const activeId = threads[0]?.id ?? null;
  const messages = activeId
    ? await service.listPortalMessages(ctx.clientOrgId, activeId)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          Messages
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Conversations with the {ctx.accountName} team that include you.
        </p>
      </div>

      <PortalMessagesInbox
        clientOrgId={ctx.clientOrgId}
        currentUserId={ctx.userId}
        threads={threads}
        initialThreadId={activeId}
        initialMessages={messages}
      />
    </div>
  );
}
