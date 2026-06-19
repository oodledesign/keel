'use client';

import { useState, useTransition } from 'react';

import { Loader2, PlugZap } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

type Props = {
  token: string;
  workspaceName: string;
  googleClientId: string | null;
  googleScopes: string;
};

export function SignaturesGoogleConnectClient({
  token,
  workspaceName,
  googleClientId,
  googleScopes,
}: Props) {
  const [primaryDomain, setPrimaryDomain] = useState('');
  const [delegatedAdminEmail, setDelegatedAdminEmail] = useState('');
  const [pending, startTransition] = useTransition();

  const connect = () => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/signatures/google-connect-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            primaryDomain,
            delegatedAdminEmail,
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || 'Connection failed');
        }
        window.location.assign('/connect/signatures/success?provider=google');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Connection failed',
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#0F1B35] p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-[var(--keel-teal)]/10 p-2 text-[var(--keel-teal)]">
            <PlugZap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Google Workspace setup</h2>
            <p className="text-sm text-zinc-400">For {workspaceName}</p>
          </div>
        </div>

        <ol className="list-decimal space-y-3 pl-5 text-sm text-zinc-300">
          <li>
            In Google Admin → Security → API controls → Domain-wide delegation,
            add a new client.
          </li>
          <li>
            Client ID:{' '}
            <code className="rounded bg-black/30 px-1 py-0.5 text-xs text-[#5eead4]">
              {googleClientId ?? 'Ask Ozer support — service account not configured'}
            </code>
          </li>
          <li>
            OAuth scopes:{' '}
            <code className="break-all rounded bg-black/30 px-1 py-0.5 text-xs">
              {googleScopes}
            </code>
          </li>
          <li>
            After authorizing, enter your workspace domain and super-admin email
            below so Ozer can verify access.
          </li>
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="google-domain">Primary domain</Label>
          <Input
            id="google-domain"
            placeholder="example.com"
            value={primaryDomain}
            onChange={(e) => setPrimaryDomain(e.target.value)}
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="google-admin">Super admin email</Label>
          <Input
            id="google-admin"
            type="email"
            placeholder="admin@example.com"
            value={delegatedAdminEmail}
            onChange={(e) => setDelegatedAdminEmail(e.target.value)}
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
      </div>

      <Button
        type="button"
        onClick={connect}
        disabled={
          pending || !primaryDomain.trim() || !delegatedAdminEmail.trim()
        }
        className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verifying…
          </>
        ) : (
          'Verify and connect'
        )}
      </Button>
    </div>
  );
}
