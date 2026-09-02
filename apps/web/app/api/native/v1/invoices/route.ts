import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError } from '~/lib/native/http';
import { listNativeInvoices } from '~/lib/native/invoices';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      url.searchParams.get('workspace'),
    );
    const items = await listNativeInvoices(auth.context.supabase, workspace, {
      status: url.searchParams.get('status'),
    });
    return NextResponse.json({ items });
  } catch (error) {
    return handleNativeError(error, 'invoices');
  }
}
