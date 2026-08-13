import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { TaskPersonAssigneeOption } from '~/lib/tasks/task-person-assignee';

function displayNameFromParts(
  fullName: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string | null | undefined,
): string {
  const composed = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName?.trim() || composed || email?.trim() || 'Unknown';
}

/**
 * Team members + CRM contacts for person-assignee pickers.
 * When `clientId` is set, contacts are limited to that client; otherwise
 * all workspace contacts (capped) are returned.
 */
export async function loadTaskPersonAssigneeOptions(
  admin: SupabaseClient,
  accountId: string,
  options?: { clientId?: string | null; limitContacts?: number },
): Promise<TaskPersonAssigneeOption[]> {
  const limitContacts = options?.limitContacts ?? 80;
  const results: TaskPersonAssigneeOption[] = [];

  const { data: memberships } = await admin
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId);

  const memberIds = [
    ...new Set(
      ((memberships ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
    ),
  ];

  if (memberIds.length > 0) {
    const { data: personalAccounts } = await admin
      .from('accounts')
      .select('id, name, email, picture_url')
      .in('id', memberIds);

    const accountById = new Map(
      (
        (personalAccounts ?? []) as Array<{
          id: string;
          name?: string | null;
          email?: string | null;
          picture_url?: string | null;
        }>
      ).map((row) => [row.id, row]),
    );

    for (const userId of memberIds) {
      const personalAccount = accountById.get(userId);
      let email = personalAccount?.email?.trim() || null;
      let name = personalAccount?.name?.trim() || null;

      // Fall back to auth metadata only when personal account lacks email/name.
      if (!email || !name) {
        try {
          const { data: authUser } = await admin.auth.admin.getUserById(userId);
          email = email || authUser?.user?.email?.trim() || null;
          if (!name) {
            const meta = authUser?.user?.user_metadata as
              | Record<string, unknown>
              | undefined;
            if (meta) {
              for (const key of ['full_name', 'name'] as const) {
                const value = meta[key];
                if (typeof value === 'string' && value.trim()) {
                  name = value.trim();
                  break;
                }
              }
            }
          }
        } catch {
          // ignore auth lookup failures; continue with account fields
        }
      }

      if (!email && !name) continue;

      results.push({
        kind: 'member',
        id: userId,
        label: name || email || userId.slice(0, 8),
        email,
        pictureUrl: personalAccount?.picture_url ?? null,
      });
    }
  }

  let contactIds: string[] | null = null;
  if (options?.clientId) {
    const { data: links } = await admin
      .from('client_contacts')
      .select('contact_id')
      .eq('client_id', options.clientId);
    contactIds = [
      ...new Set(
        ((links ?? []) as Array<{ contact_id: string }>).map(
          (r) => r.contact_id,
        ),
      ),
    ];
    if (contactIds.length === 0) {
      return results;
    }
  }

  let contactsQuery = admin
    .from('contacts')
    .select('id, full_name, first_name, last_name, email, picture_url')
    .eq('account_id', accountId)
    .order('full_name', { ascending: true })
    .limit(limitContacts);

  if (contactIds) {
    contactsQuery = contactsQuery.in('id', contactIds);
  }

  const { data: contacts } = await contactsQuery;

  for (const row of (contacts ?? []) as Array<{
    id: string;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    picture_url?: string | null;
  }>) {
    results.push({
      kind: 'contact',
      id: row.id,
      label: displayNameFromParts(
        row.full_name,
        row.first_name,
        row.last_name,
        row.email,
      ),
      email: row.email?.trim() || null,
      pictureUrl: row.picture_url ?? null,
    });
  }

  return results;
}
