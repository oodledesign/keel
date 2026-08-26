'use client';

import Image from 'next/image';
import { useTransition } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { Heading } from '@kit/ui/heading';
import { If } from '@kit/ui/if';
import { Separator } from '@kit/ui/separator';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

import { acceptInvitationAction } from '../../server/actions/team-invitations-server-actions';
import { InvitationSubmitButton } from './invitation-submit-button';
import { SignOutInvitationButton } from './sign-out-invitation-button';

export function AcceptInvitationContainer(props: {
  inviteToken: string;
  email: string;

  invitation: {
    id: string;

    account: {
      name: string;
      id: string;
      picture_url: string | null;
    };
  };

  paths: {
    signOutNext: string;
    nextPath: string;
  };
}) {
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await acceptInvitationAction(formData);
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }

        toast.error(
          error instanceof Error
            ? error.message
            : 'We could not add you to the workspace. Please try again.',
        );
      }
    });
  }

  return (
    <div className={'flex flex-col items-center space-y-4'}>
      <Heading className={'text-center'} level={4}>
        <Trans
          i18nKey={'teams:acceptInvitationHeading'}
          values={{
            accountName: props.invitation.account.name,
          }}
        />
      </Heading>

      <If condition={props.invitation.account.picture_url}>
        {(url) => (
          <Image
            alt={`Logo`}
            src={url}
            width={64}
            height={64}
            className={'object-cover'}
          />
        )}
      </If>

      <div className={'text-muted-foreground text-center text-sm'}>
        <Trans
          i18nKey={'teams:acceptInvitationDescription'}
          values={{
            accountName: props.invitation.account.name,
          }}
        />
      </div>

      <div className={'flex flex-col space-y-4'}>
        <form
          data-test={'join-team-form'}
          className={'w-full'}
          action={onSubmit}
        >
          <input type="hidden" name={'inviteToken'} value={props.inviteToken} />

          <input
            type={'hidden'}
            name={'nextPath'}
            value={props.paths.nextPath}
          />

          <InvitationSubmitButton
            email={props.email}
            accountName={props.invitation.account.name}
            pending={pending}
          />
        </form>

        <Separator />

        <SignOutInvitationButton nextPath={props.paths.signOutNext} />

        <span className={'text-muted-foreground text-center text-xs'}>
          <Trans i18nKey={'teams:signInWithDifferentAccountDescription'} />
        </span>
      </div>
    </div>
  );
}
