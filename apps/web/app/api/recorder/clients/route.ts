import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { clientDisplayName } from '~/lib/recorder/client-display-name';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ClientRow = {
  id: string;
  display_name: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, { touchLastUsed: true });
  if (auth instanceof NextResponse) {
    return auth;
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get('account_id') ?? auth.account_id;

  const admin = getSupabaseServerAdminClient();

  try {
    await assertWorkspaceMember(admin, accountId, auth.user_id);
  } catch {
    return badRequest('Invalid workspace for this token');
  }

  const { data, error } = await admin
    .from('clients')
    .select('id, display_name, company_name, first_name, last_name')
    .eq('account_id', accountId);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load clients' },
      { status: 500 },
    );
  }

  const clients = ((data ?? []) as ClientRow[])
    .map((row) => ({
      id: row.id,
      name: clientDisplayName(row),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(clients);
}
