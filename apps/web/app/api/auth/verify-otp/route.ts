import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

/**
 * Verify OTP (e.g. email confirmation) when token is sent from client (e.g. from URL hash).
 * Supabase sometimes redirects with tokens in the fragment (#), which the server cannot read.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token_hash = body.token_hash as string | undefined;
  const type = body.type as string | undefined;

  if (!token_hash || !type) {
    return NextResponse.json(
      { error: 'token_hash and type required' },
      { status: 400 },
    );
  }

  const client = getSupabaseServerClient();
  const { error } = await client.auth.verifyOtp({
    type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink',
    token_hash,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
