import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const supabase = getSupabaseServerAdminClient();
  const { data } = await supabase
    .from('email_suppressions')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  return !!data;
}
