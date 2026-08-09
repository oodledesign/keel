import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { MailboxKind } from './mailbox-kind';
import { resolveNeedsReplyWorkspaceAccountId } from './needs-reply-workspace-affinity';

/**
 * Personal mailbox AI bills the personal account (user id).
 * Business mailbox AI bills the linked workspace when one can be resolved.
 */
export async function resolveEmailAssistantBillingAccountId(
  admin: SupabaseClient,
  params: {
    userId: string;
    mailboxKind: MailboxKind;
    preferredAccountId?: string | null;
  },
): Promise<string> {
  if (params.mailboxKind === 'personal') {
    return params.userId;
  }

  const workspaceId = await resolveNeedsReplyWorkspaceAccountId(admin, {
    userId: params.userId,
    preferredAccountId: params.preferredAccountId,
  });

  return workspaceId ?? params.userId;
}
