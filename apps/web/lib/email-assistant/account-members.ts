import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ExtractAccountMember } from '@kit/email-assistant';

export async function loadAccountMembersForExtraction(
  admin: SupabaseClient,
  accountId: string,
): Promise<ExtractAccountMember[]> {
  const { data: memberships, error } = await admin
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId);

  if (error || !memberships?.length) {
    return [];
  }

  const members: ExtractAccountMember[] = [];

  for (const row of memberships as Array<{ user_id: string }>) {
    const userId = row.user_id;

    const [{ data: authUser }, { data: personalAccount }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin
        .from('accounts')
        .select('name, email')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    const email =
      authUser?.user?.email?.trim() ||
      (personalAccount as { email?: string | null } | null)?.email?.trim() ||
      '';

    if (!email) {
      continue;
    }

    const meta = authUser?.user?.user_metadata as
      | Record<string, unknown>
      | undefined;
    let name =
      (personalAccount as { name?: string | null } | null)?.name?.trim() ||
      null;

    if (!name && meta) {
      for (const key of ['full_name', 'name'] as const) {
        const value = meta[key];
        if (typeof value === 'string' && value.trim()) {
          name = value.trim();
          break;
        }
      }
    }

    members.push({ userId, name, email });
  }

  return members;
}

export function resolveSuggestedAssigneeId(
  item: {
    suggestedAssigneeEmail: string | null;
    assigneeConfidence: number | null;
  },
  members: ExtractAccountMember[],
  mailboxOwnerEmail: string,
): string | null {
  const ownerEmail = mailboxOwnerEmail.trim().toLowerCase();
  const suggestedEmail =
    item.suggestedAssigneeEmail?.trim().toLowerCase() || null;

  if (!suggestedEmail) {
    return null;
  }

  const member = members.find(
    (entry) => entry.email.trim().toLowerCase() === suggestedEmail,
  );

  if (member) {
    return member.userId;
  }

  if (suggestedEmail === ownerEmail) {
    const ownerMember = members.find(
      (entry) => entry.email.trim().toLowerCase() === ownerEmail,
    );
    return ownerMember?.userId ?? null;
  }

  return null;
}

export function shouldIncludeExtractedItem(
  item: {
    suggestedAssigneeEmail: string | null;
    assigneeConfidence: number | null;
  },
  members: ExtractAccountMember[],
  mailboxOwnerEmail: string,
): boolean {
  const ownerEmail = mailboxOwnerEmail.trim().toLowerCase();
  const suggestedEmail =
    item.suggestedAssigneeEmail?.trim().toLowerCase() || null;

  if (!suggestedEmail) {
    return true;
  }

  if (suggestedEmail === ownerEmail) {
    return true;
  }

  const memberEmails = new Set(
    members.map((entry) => entry.email.trim().toLowerCase()),
  );

  return memberEmails.has(suggestedEmail);
}
