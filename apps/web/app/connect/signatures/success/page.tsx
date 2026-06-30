import Link from 'next/link';

type PageProps = {
  searchParams: Promise<{ provider?: string }>;
};

export const metadata = {
  title: 'Connection complete',
  robots: { index: false, follow: false },
};

export default async function SignaturesConnectSuccessPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const provider =
    sp.provider === 'google' ? 'Google Workspace' : 'Microsoft 365';

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-16 text-[var(--workspace-shell-text)]">
      <div className="rounded-2xl border border-[var(--ozer-accent)]/30 bg-[var(--ozer-surface-panel)] p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold tracking-tight">You&apos;re all set</h1>
        <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
          {provider} is now connected for this business in Ozer Signatures. The
          workspace owner can sync staff and push email signatures — no further
          action is needed from you.
        </p>
        <p className="mt-6 text-xs text-[var(--workspace-shell-text-muted)]">You can close this window.</p>
      </div>
    </main>
  );
}
