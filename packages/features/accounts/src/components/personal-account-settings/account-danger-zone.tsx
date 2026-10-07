'use client';

import { useFormStatus } from 'react-dom';

import { zodResolver } from '@hookform/resolvers/zod';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { ErrorBoundary } from '@kit/monitoring/components';
import { VerifyOtpForm } from '@kit/otp/components';
import { useUser } from '@kit/supabase/hooks/use-user';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Form } from '@kit/ui/form';
import { Spinner } from '@kit/ui/spinner';
import { Trans } from '@kit/ui/trans';

import { DeletePersonalAccountSchema } from '../../schema/delete-personal-account.schema';
import {
  deletePersonalAccountAction,
  loadAccountDeletionEligibilityAction,
} from '../../server/personal-accounts-server-actions';
import type { OwnedTeamWorkspace } from '../../server/services/account-deletion.shared';

export function AccountDangerZone() {
  return (
    <div className={'flex flex-col space-y-4'}>
      <div className={'flex flex-col space-y-1'}>
        <span className={'text-sm font-medium'}>
          <Trans i18nKey={'account:deleteAccount'} />
        </span>

        <p className={'text-muted-foreground text-sm'}>
          <Trans i18nKey={'account:deleteAccountDescription'} />
        </p>
      </div>

      <div>
        <DeleteAccountModal />
      </div>
    </div>
  );
}

function DeleteAccountModal() {
  const { data: user } = useUser();

  if (!user?.email) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button data-test={'delete-account-button'} variant={'destructive'}>
          <Trans i18nKey={'account:deleteAccount'} />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans i18nKey={'account:deleteAccount'} />
          </AlertDialogTitle>
        </AlertDialogHeader>

        <ErrorBoundary fallback={<DeleteAccountErrorContainer />}>
          <DeleteAccountGate email={user.email} />
        </ErrorBoundary>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteAccountGate(props: { email: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['account-deletion-eligibility'],
    queryFn: () => loadAccountDeletionEligibilityAction(),
    staleTime: 0,
  });

  if (isPending) {
    return (
      <div className={'flex justify-center py-6'}>
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return <DeleteAccountErrorContainer />;
  }

  const blockers = data.blockers.filter(
    (blocker) => blocker !== 'recent_sign_in_required',
  );

  if (!data.enabled || blockers.length > 0) {
    const sharedWorkspaces = workspaceNames(
      data.ownedTeamWorkspaces.filter((w) => w.otherMemberCount > 0),
    );
    const scheduledDate = data.scheduledFor
      ? new Date(data.scheduledFor).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';

    return (
      <div className="flex flex-col gap-y-4">
        <Alert variant={'destructive'}>
          <ExclamationTriangleIcon className={'h-4'} />

          <AlertTitle>
            <Trans i18nKey={'account:deleteAccountBlockedHeading'} />
          </AlertTitle>

          <AlertDescription>
            <ul className={'list-disc space-y-1 pl-4'}>
              {!data.enabled ? (
                <li>
                  <Trans i18nKey={'account:deleteAccountBlockers.disabled'} />
                </li>
              ) : null}
              {blockers.map((blocker) => (
                <li key={blocker}>
                  <Trans
                    i18nKey={`account:deleteAccountBlockers.${blocker}`}
                    values={{
                      date: scheduledDate,
                      workspaces: sharedWorkspaces,
                    }}
                  />
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>

        <div>
          <AlertDialogCancel>
            <Trans i18nKey={'common:cancel'} />
          </AlertDialogCancel>
        </div>
      </div>
    );
  }

  return (
    <DeleteAccountForm
      email={props.email}
      soloWorkspaces={workspaceNames(data.ownedTeamWorkspaces)}
    />
  );
}

function workspaceNames(workspaces: OwnedTeamWorkspace[]) {
  return workspaces.map((workspace) => workspace.name).join(', ');
}

function DeleteAccountForm(props: { email: string; soloWorkspaces: string }) {
  const form = useForm({
    resolver: zodResolver(DeletePersonalAccountSchema),
    defaultValues: {
      otp: '',
    },
  });

  const { otp } = useWatch({ control: form.control });

  if (!otp) {
    return (
      <VerifyOtpForm
        purpose={'delete-personal-account'}
        email={props.email}
        onSuccess={(otp) => form.setValue('otp', otp, { shouldValidate: true })}
        CancelButton={
          <AlertDialogCancel>
            <Trans i18nKey={'common:cancel'} />
          </AlertDialogCancel>
        }
      />
    );
  }

  return (
    <Form {...form}>
      <form
        data-test={'delete-account-form'}
        action={deletePersonalAccountAction}
        className={'flex flex-col space-y-4'}
      >
        <input type="hidden" name="otp" value={otp} />

        <div className={'flex flex-col space-y-6'}>
          <div
            className={
              'border-destructive text-destructive rounded-md border p-4 text-sm'
            }
          >
            <div className={'flex flex-col space-y-2'}>
              <div>
                <Trans i18nKey={'account:deleteAccountDescription'} />
              </div>

              {props.soloWorkspaces ? (
                <div>
                  <Trans
                    i18nKey={'account:deleteAccountAlsoDeleted'}
                    values={{ workspaces: props.soloWorkspaces }}
                  />
                </div>
              ) : null}

              <div>
                <Trans i18nKey={'common:modalConfirmationQuestion'} />
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans i18nKey={'common:cancel'} />
          </AlertDialogCancel>

          <DeleteAccountSubmitButton disabled={!form.formState.isValid} />
        </AlertDialogFooter>
      </form>
    </Form>
  );
}

function DeleteAccountSubmitButton(props: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      data-test={'confirm-delete-account-button'}
      type={'submit'}
      disabled={pending || props.disabled}
      name={'action'}
      variant={'destructive'}
    >
      {pending ? (
        <Trans i18nKey={'account:deletingAccount'} />
      ) : (
        <Trans i18nKey={'account:deleteAccount'} />
      )}
    </Button>
  );
}

function DeleteAccountErrorContainer() {
  return (
    <div className="flex flex-col gap-y-4">
      <DeleteAccountErrorAlert />

      <div>
        <AlertDialogCancel>
          <Trans i18nKey={'common:cancel'} />
        </AlertDialogCancel>
      </div>
    </div>
  );
}

function DeleteAccountErrorAlert() {
  return (
    <Alert variant={'destructive'}>
      <ExclamationTriangleIcon className={'h-4'} />

      <AlertTitle>
        <Trans i18nKey={'account:deleteAccountErrorHeading'} />
      </AlertTitle>

      <AlertDescription>
        <Trans i18nKey={'common:genericError'} />
      </AlertDescription>
    </Alert>
  );
}
