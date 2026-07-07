'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { MailCheck } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';

export function VerifyEmailContent({ email }: { email: string | null }) {
  const client = useSupabase();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function resendVerificationEmail() {
    if (!email) {
      toast.error('No email address found for this account.');
      return;
    }

    startTransition(async () => {
      const { error } = await client.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${pathsConfig.auth.callback}`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setSent(true);
      toast.success('Verification email sent.');
    });
  }

  return (
    <div className="space-y-6">
      <Alert variant="default">
        <MailCheck className="h-4 w-4" />
        <AlertTitle>
          <Trans i18nKey="auth:verifyEmailHeading" defaults="Verify your email" />
        </AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            <Trans
              i18nKey="auth:verifyEmailBody"
              defaults="We sent a confirmation link to your inbox. Confirm your email before using Keel."
            />
          </p>
          {email ? (
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">{email}</p>
          ) : null}
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="keel-gradient-btn w-full"
          disabled={pending || sent}
          onClick={resendVerificationEmail}
        >
          {sent ? (
            <Trans i18nKey="auth:verificationEmailSent" defaults="Email sent" />
          ) : (
            <Trans i18nKey="auth:resendVerificationEmail" defaults="Resend verification email" />
          )}
        </Button>

        <Button asChild type="button" variant="outline" className="w-full">
          <Link href={pathsConfig.auth.signIn}>
            <Trans i18nKey="auth:backToSignIn" defaults="Back to sign in" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
