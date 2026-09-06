import { redirect } from 'next/navigation';

import { MARKETING_FREE_SIGNUP_URL } from '~/lib/billing/pricing-marketing';

/**
 * Legacy marketing gauntlet (personal → workspace → plan).
 * Start free now goes straight to auth; keep this path as a one-hop redirect.
 */
export default function StartPage() {
  redirect(MARKETING_FREE_SIGNUP_URL);
}
