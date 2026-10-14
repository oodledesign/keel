import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import {
  type IgInboxConversation,
  type IgInboxMessage,
  InstagramInbox,
} from '../../(instagram-autoreply)/_components/instagram-inbox';
import { InstagramSubnav } from '../../(instagram-autoreply)/_components/instagram-subnav';
import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';

const CONTACT_COLUMNS =
  'id, username, display_name, last_inbound_at, handoff_at, opted_out_at';

type ContactRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  last_inbound_at: string | null;
  handoff_at: string | null;
  opted_out_at: string | null;
};

type InstagramInboxPageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ contact?: string }>;
};

function toConversation(row: ContactRow): IgInboxConversation {
  return {
    id: row.id,
    label: row.username
      ? `@${row.username}`
      : (row.display_name ?? 'Instagram user'),
    lastInboundAt: row.last_inbound_at,
    handedOff: Boolean(row.handoff_at),
    optedOut: Boolean(row.opted_out_at),
  };
}

export default async function InstagramInboxPage({
  params,
  searchParams,
}: InstagramInboxPageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  const [handedOffRes, recentRes] = await Promise.all([
    client
      .from('ig_contacts')
      .select(CONTACT_COLUMNS)
      .eq('account_id', accountId)
      .not('handoff_at', 'is', null)
      .order('last_inbound_at', { ascending: false, nullsFirst: false })
      .limit(50),
    client
      .from('ig_contacts')
      .select(CONTACT_COLUMNS)
      .eq('account_id', accountId)
      .is('handoff_at', null)
      .not('last_inbound_at', 'is', null)
      .order('last_inbound_at', { ascending: false })
      .limit(50),
  ]);
  if (handedOffRes.error) throw new Error(handedOffRes.error.message);
  if (recentRes.error) throw new Error(recentRes.error.message);

  const conversations = [
    ...((handedOffRes.data ?? []) as ContactRow[]),
    ...((recentRes.data ?? []) as ContactRow[]),
  ].map(toConversation);

  let selected = conversations.find((c) => c.id === sp.contact) ?? null;
  if (!selected && sp.contact) {
    const { data } = await client
      .from('ig_contacts')
      .select(CONTACT_COLUMNS)
      .eq('account_id', accountId)
      .eq('id', sp.contact)
      .maybeSingle();
    selected = data ? toConversation(data as ContactRow) : null;
  }
  selected ??= conversations[0] ?? null;

  let messages: IgInboxMessage[] = [];
  if (selected) {
    const { data, error } = await client
      .from('ig_message_events')
      .select('id, direction, event_type, body, send_status, created_at')
      .eq('contact_id', selected.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    messages = (data ?? [])
      .map((row) => ({
        id: row.id,
        direction: row.direction as IgInboxMessage['direction'],
        eventType: row.event_type,
        body: row.body,
        sendStatus: row.send_status,
        createdAt: row.created_at,
      }))
      .reverse();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Instagram inbox"
        description="Pick up conversations your automations hand over, and reply within Instagram's 24-hour window."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <InstagramSubnav account={account} />
        <InstagramInbox
          accountId={accountId}
          inboxPath={pathsConfig.app.accountInstagramAutoreplyInbox.replace(
            '[account]',
            account,
          )}
          conversations={conversations}
          selected={selected}
          messages={messages}
          renderedAt={Date.now()}
        />
      </PageBody>
    </>
  );
}
