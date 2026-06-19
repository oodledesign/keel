import {
  decodeUnsubscribeToken,
  unsubscribeEmail,
} from '~/lib/admin-email/campaigns';
import { getMarketingSiteOrigin } from '~/lib/app-host-routing';

export const metadata = {
  title: 'Unsubscribe',
};

export const dynamic = 'force-dynamic';

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const email = token ? decodeUnsubscribeToken(token) : null;
  let error: string | null = null;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (email) {
    try {
      await unsubscribeEmail(email);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to unsubscribe';
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B132B] px-6 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-[#0F1B35] p-8 text-center shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2A9D8F]">
          {productName}
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">
          {email && !error ? 'You have been unsubscribed' : 'Invalid unsubscribe link'}
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          {email && !error
            ? `${email} will no longer receive marketing campaigns from ${productName}.`
            : error ?? 'This unsubscribe link is missing or has expired.'}
        </p>
        <a
          href={getMarketingSiteOrigin()}
          className="mt-8 inline-flex rounded-full bg-[#2A9D8F] px-5 py-3 text-sm font-bold text-[#0B132B]"
        >
          Back to {productName}
        </a>
      </div>
    </main>
  );
}
