'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

export function InvitationSubmitButton(props: {
  accountName: string;
  email: string;
  /** When the parent drives pending via useTransition */
  pending?: boolean;
}) {
  const { pending: formPending } = useFormStatus();
  const pending = props.pending ?? formPending;

  return (
    <Button type={'submit'} className={'w-full'} disabled={pending}>
      <Trans
        i18nKey={pending ? 'teams:joiningTeam' : 'teams:continueAs'}
        values={{
          accountName: props.accountName,
          email: props.email,
        }}
      />
    </Button>
  );
}
