import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export async function assertMessagesSchemaAvailable() {
  const client = getSupabaseServerAdminClient();
  const { error } = await client.from('chat_threads').select('id').limit(1);
  return !error;
}
