import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createDynamicsConnectionService } from '~/lib/dynamics/connection.service';
import { describeFutureDynamicsInboundPause } from '~/lib/dynamics/inbound';
import type { DynamicsConnectionPublic } from '~/lib/dynamics/types';

export async function loadDynamicsConnection(
  accountId: string,
): Promise<DynamicsConnectionPublic> {
  const client = getSupabaseServerClient();
  return createDynamicsConnectionService(client).getPublic(accountId);
}

export function loadDynamicsInboundStub() {
  return describeFutureDynamicsInboundPause();
}
