import { NextResponse } from 'next/server';
import { z } from 'zod';

import { exchangeDesktopConnectCode } from '~/lib/recorder/desktop-connect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const token = await exchangeDesktopConnectCode(parsed.data);
  if (!token) {
    return NextResponse.json({ error: 'Invalid or expired connect code' }, { status: 401 });
  }

  return NextResponse.json({ token });
}
