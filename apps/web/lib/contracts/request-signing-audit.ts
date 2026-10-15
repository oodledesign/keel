import 'server-only';

import { headers } from 'next/headers';

/**
 * Capture IP and user-agent for contract signing audit trails.
 * Uses the first x-forwarded-for hop when present (Vercel / proxies).
 */
export async function readSigningAuditFromHeaders(): Promise<{
  signed_ip: string | null;
  signed_user_agent: string | null;
}> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const realIp = h.get('x-real-ip')?.trim() || null;
  const ua = h.get('user-agent')?.trim() || null;
  return {
    signed_ip: forwarded || realIp,
    signed_user_agent: ua ? ua.slice(0, 1000) : null,
  };
}
