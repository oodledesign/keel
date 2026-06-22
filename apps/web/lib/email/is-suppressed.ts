import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const { data } = await supabase
    .from('email_suppressions')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  return !!data;
}
