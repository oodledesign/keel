import { NextResponse } from 'next/server';

import { getVapidPublicKey } from '~/lib/planner/web-push';

export const dynamic = 'force-dynamic';

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { configured: false, publicKey: null },
      { status: 503 },
    );
  }

  return NextResponse.json({ configured: true, publicKey });
}
