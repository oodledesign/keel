import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const authorizationId = formData.get('authorization_id')?.toString().trim();
  const decision = formData.get('decision')?.toString().trim();

  if (!authorizationId) {
    return NextResponse.json(
      { error: 'Missing authorization_id' },
      { status: 400 },
    );
  }

  if (decision !== 'approve' && decision !== 'deny') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const result =
    decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        });

  if (result.error || !result.data?.redirect_url) {
    return NextResponse.json(
      { error: result.error?.message ?? 'Failed to process consent decision' },
      { status: 400 },
    );
  }

  // OAuth 2.1 expects 302/303 so the browser follows with GET. Next.js defaults
  // to 307, which preserves POST — Claude's callback only accepts GET.
  return NextResponse.redirect(result.data.redirect_url, 303);
}
