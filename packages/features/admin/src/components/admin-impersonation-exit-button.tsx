'use client';

import { useState, useTransition } from 'react';

import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { cn } from '@kit/ui/utils';

import { endImpersonationAction } from '../lib/server/admin-server-actions';

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  nonce: string;
};

export function AdminImpersonationExitButton(props: {
  viewingAsEmail: string | null;
}) {
  const [tokens, setTokens] = useState<SessionTokens>();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (tokens) {
    return (
      <>
        <RestoreAdminSession
          tokens={tokens}
          onError={(message) => {
            setTokens(undefined);
            setError(message);
          }}
        />
        <LoadingOverlay>Restoring admin session...</LoadingOverlay>
      </>
    );
  }

  return (
    <div
      className={cn(
        'fixed top-1/2 right-0 z-[100] flex -translate-y-1/2 flex-col items-end gap-1',
        'pr-0',
      )}
    >
      <div className="border-border bg-background/95 shadow-lg backdrop-blur-sm">
        <div className="border-border max-w-52 border-y border-l px-3 py-2">
          <p className="text-muted-foreground text-[11px] leading-tight">
            Viewing as
          </p>
          <p className="truncate text-xs font-medium">
            {props.viewingAsEmail ?? 'user'}
          </p>
          {error ? (
            <p className="text-destructive mt-1 text-[11px]">{error}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          className={cn(
            'h-auto w-full rounded-none rounded-l-md border-0 px-3 py-2.5',
            'bg-[var(--ozer-accent)] text-[var(--ozer-text-on-dark)]',
            'hover:bg-[var(--ozer-accent-hover)]',
          )}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const result = await endImpersonationAction({});
                setTokens({
                  ...result,
                  nonce: crypto.randomUUID(),
                });
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Could not restore admin session',
                );
              }
            });
          }}
        >
          <ShieldCheck className="size-4" />
          {pending ? 'Restoring…' : 'Back to admin'}
        </Button>
      </div>
    </div>
  );
}

function RestoreAdminSession(props: {
  tokens: SessionTokens;
  onError: (message: string) => void;
}) {
  useRestoreAdminSession(props.tokens, props.onError);
  return null;
}

function useRestoreAdminSession(
  tokens: SessionTokens,
  onError: (message: string) => void,
) {
  const supabase = useSupabase();

  return useQuery({
    // Opaque nonce only — never put bearer tokens in the query cache key.
    queryKey: ['end-impersonation', tokens.nonce],
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const { error: signOutError } = await supabase.auth.signOut({
        scope: 'local',
      });

      if (signOutError) {
        onError(signOutError.message);
        throw signOutError;
      }

      const { data, error: setSessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (setSessionError || !data.session) {
        const message =
          setSessionError?.message ??
          'Could not restore admin session. Sign in again from /auth/sign-in.';
        onError(message);
        throw new Error(message);
      }

      window.location.replace('/admin');
      return true;
    },
  });
}
