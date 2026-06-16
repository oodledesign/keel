import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

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

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, { touchLastUsed: true });
  if (auth instanceof NextResponse) {
    return auth;
  }

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('clients')
    .select('id, display_name, company_name, first_name, last_name')
    .eq('account_id', auth.account_id);

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
