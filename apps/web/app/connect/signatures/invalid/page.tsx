import Link from 'next/link';

type PageProps = {
  searchParams: Promise<{ reason?: string; message?: string }>;
};

export const metadata = {
  title: 'Connection unavailable',
  robots: { index: false, follow: false },
};

export default async function SignaturesConnectInvalidPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const detail =
    sp.message || sp.reason || 'This integration link is not valid.';

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-16 text-[var(--workspace-shell-text)]">
      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] p-8 shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight">Link unavailable</h1>
        <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
          {detail}
        </p>
        <p className="mt-4 text-xs text-[var(--workspace-shell-text-muted)]">
          Ask the business owner to generate a new link from Ozer → Signatures →
          Settings.
        </p>
      </div>
    </main>
  );
}
