import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  getGoogleServiceAccountClientId,
} from '~/lib/signatures/google-workspace';
import { loadIntegrationInviteByToken } from '~/lib/signatures/integration-invite';

import { SignaturesGoogleConnectClient } from './_components/signatures-google-connect-client';

const GOOGLE_SCOPES =
  'https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/gmail.settings.basic';

type PageProps = {
  params: Promise<{ token: string }>;
};

export const metadata = {
  title: 'Connect email signatures',
  robots: { index: false, follow: false },
};

export default async function SignaturesConnectPage({ params }: PageProps) {
  const { token } = await params;
  const invite = await loadIntegrationInviteByToken(token);

  if (!invite) {
    redirect(
      '/connect/signatures/invalid?reason=This%20link%20is%20invalid%2C%20expired%2C%20or%20already%20used',
    );
  }

  const admin = getSupabaseServerAdminClient();
  const { data: account } = await admin
    .from('accounts')
    .select('name, slug')
    .eq('id', invite.account_id)
    .maybeSingle();

  const workspaceName =
    (account?.name as string | null)?.trim() ||
    (account?.slug as string | null)?.trim() ||
    'this workspace';

  if (invite.provider === 'microsoft') {
    const authUrl = `/api/signatures/ms-delegated-auth?token=${encodeURIComponent(token)}`;

    return (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-16 text-white">
        <div className="rounded-2xl border border-white/10 bg-[#0F1B35] p-8 shadow-xl">
          <h1 className="text-2xl font-bold tracking-tight">
            Connect Microsoft 365
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            You were invited to connect <strong className="text-white">{workspaceName}</strong>{' '}
            to Ozer Signatures. Sign in with a Microsoft 365 administrator account
            and grant consent. You do not need a Ozer login.
          </p>
          <Link
            href={authUrl}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--keel-teal)] px-4 py-3 text-sm font-medium text-white hover:bg-[#238b7f]"
          >
            Continue with Microsoft admin consent
          </Link>
          <p className="mt-4 text-xs text-zinc-500">
            This link expires soon and works once. After connecting, you can close
            this page — the business owner manages signatures in Ozer.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-white">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Connect Google Workspace
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Complete domain-wide delegation for{' '}
          <strong className="text-white">{workspaceName}</strong>. No Ozer account
          required.
        </p>
      </div>
      <SignaturesGoogleConnectClient
        token={token}
        workspaceName={workspaceName}
        googleClientId={getGoogleServiceAccountClientId()}
        googleScopes={GOOGLE_SCOPES}
      />
    </main>
  );
}
