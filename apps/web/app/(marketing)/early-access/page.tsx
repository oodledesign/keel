import { redirect } from 'next/navigation';

/**
 * September tester / 15%-for-life offer is withdrawn.
 * Keep the URL so old links land on public pricing.
 */
export default function EarlyAccessPage() {
  redirect('/pricing');
}
