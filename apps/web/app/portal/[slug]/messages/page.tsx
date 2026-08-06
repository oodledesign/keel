import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PortalMessagesThread } from '../_components/portal-messages-thread';
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

  const threadId = await service.getOrCreateMessageThread(ctx.clientOrgId);
  const messages = await service.listPortalMessages(ctx.clientOrgId, threadId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          Messages
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Message the {ctx.accountName} team directly.
        </p>
      </div>

      <PortalMessagesThread
        clientOrgId={ctx.clientOrgId}
        threadId={threadId}
        currentUserId={ctx.userId}
        initialMessages={messages}
      />
    </div>
  );
}
