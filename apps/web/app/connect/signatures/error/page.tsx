import Link from 'next/link';

type PageProps = {
  searchParams: Promise<{ message?: string }>;
};

export const metadata = {
  title: 'Connection failed',
  robots: { index: false, follow: false },
};

export default async function SignaturesConnectErrorPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const detail = sp.message || 'Something went wrong during setup.';

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-16 text-[var(--workspace-shell-text)]">
      <div className="rounded-2xl border border-red-500/30 bg-[var(--ozer-surface-panel)] p-8 shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight">Connection failed</h1>
        <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">{detail}</p>
        <p className="mt-4 text-xs text-[var(--workspace-shell-text-muted)]">
          If you are the IT administrator, check permissions and try again. The
          business owner can issue a new link from Ozer if this one expired.
        </p>
      </div>
    </main>
  );
}
