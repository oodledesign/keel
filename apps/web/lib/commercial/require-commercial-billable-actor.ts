import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { assertCommercialBillableMember } from '~/lib/commercial/commercial-seat-access';

/** Block support seats from commercial mutations (disposals, requirements, stages). */
export async function requireCommercialBillableActor(
  accountId: string,
  action: string,
) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  await assertCommercialBillableMember({
    client,
    accountId,
    userId: user.id,
    action,
  });
}
