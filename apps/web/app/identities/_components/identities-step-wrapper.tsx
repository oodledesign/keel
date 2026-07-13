'use client';

import { useRouter } from 'next/navigation';

import { UpdatePasswordForm } from '@kit/accounts/personal-account-settings';
import { useUser } from '@kit/supabase/hooks/use-user';
import { Spinner } from '@kit/ui/spinner';

interface IdentitiesStepWrapperProps {
  nextPath: string;
}

export function IdentitiesStepWrapper(props: IdentitiesStepWrapperProps) {
  const router = useRouter();
  const user = useUser();

  const email =
    user.data?.email?.trim() ||
    (typeof user.data?.user_metadata?.email === 'string'
      ? user.data.user_metadata.email
      : '') ||
    '';

  if (user.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 mx-auto flex w-full max-w-md flex-col space-y-5 duration-500"
      data-test="join-step-two"
    >
      <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Email
        </p>
        <p className="mt-1 truncate text-sm font-medium text-[var(--workspace-shell-text)]">
          {email || '—'}
        </p>
      </div>

      <UpdatePasswordForm
        email={email}
        callbackPath={props.nextPath}
        submitLabelKey="auth:setPasswordSubmitLabel"
        onSuccess={() => {
          router.push(props.nextPath);
          router.refresh();
        }}
      />
    </div>
  );
}
