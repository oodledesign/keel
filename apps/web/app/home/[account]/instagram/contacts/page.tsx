import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import {
  type IgContactListItem,
  InstagramContactsList,
} from '../../(instagram-autoreply)/_components/instagram-contacts-list';
import { InstagramSubnav } from '../../(instagram-autoreply)/_components/instagram-subnav';
import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';

const PAGE_SIZE = 200;
const FIELD_KEY_RE = /^[a-z0-9_]{1,40}$/i;

type InstagramContactsPageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    q?: string;
    tag?: string;
    field?: string;
    status?: string;
  }>;
};

function stringFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'string' || typeof v === 'number' ? [[k, String(v)]] : [],
    ),
  );
}

export default async function InstagramContactsPage({
  params,
  searchParams,
}: InstagramContactsPageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  let query = client
    .from('ig_contacts')
    .select(
      'id, username, display_name, tags, custom_fields, last_inbound_at, opted_out_at, handoff_at, is_follower, linked_client_id',
      { count: 'exact' },
    )
    .eq('account_id', accountId);

  const search = (sp.q ?? '')
    .replace(/[^\w. -]/g, '')
    .trim()
    .slice(0, 60);
  if (search) {
    query = query.or(
      `username.ilike."*${search}*",display_name.ilike."*${search}*"`,
    );
  }
  if (sp.tag) query = query.contains('tags', [sp.tag.toLowerCase()]);
  if (sp.field && FIELD_KEY_RE.test(sp.field)) {
    query = query.not(`custom_fields->>${sp.field}`, 'is', null);
  }
  switch (sp.status) {
    case 'followers':
      query = query.eq('is_follower', true);
      break;
    case 'crm':
      query = query.not('linked_client_id', 'is', null);
      break;
    case 'handed_off':
      query = query.not('handoff_at', 'is', null);
      break;
    case 'opted_out':
      query = query.not('opted_out_at', 'is', null);
      break;
  }

  const [{ data, count, error }, { data: facetRows }] = await Promise.all([
    query
      .order('last_inbound_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE),
    client
      .from('ig_contacts')
      .select('tags, custom_fields')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(1000),
  ]);
  if (error) throw new Error(error.message);

  const tagOptions = new Set<string>();
  const fieldOptions = new Set<string>();
  for (const row of facetRows ?? []) {
    for (const tag of row.tags ?? []) tagOptions.add(tag);
    for (const key of Object.keys(stringFields(row.custom_fields))) {
      if (FIELD_KEY_RE.test(key)) fieldOptions.add(key);
    }
  }

  const contacts: IgContactListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    tags: row.tags ?? [],
    customFields: stringFields(row.custom_fields),
    lastInboundAt: row.last_inbound_at,
    optedOut: Boolean(row.opted_out_at),
    handedOff: Boolean(row.handoff_at),
    isFollower: row.is_follower,
    linkedClientId: row.linked_client_id,
  }));

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Instagram contacts"
        description="Everyone your automations have talked to, with their tags and the details they shared."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <InstagramSubnav account={account} />
        <InstagramContactsList
          accountId={accountId}
          accountSlug={account}
          contacts={contacts}
          tagOptions={[...tagOptions].sort()}
          fieldOptions={[...fieldOptions].sort()}
          total={count ?? contacts.length}
        />
      </PageBody>
    </>
  );
}
