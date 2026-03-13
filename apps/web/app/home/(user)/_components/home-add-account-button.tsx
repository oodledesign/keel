'use client';

import { useState } from 'react';

import { CreateTeamAccountDialog } from '@kit/team-accounts/components';
import { Button } from '@kit/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { Trans } from '@kit/ui/trans';

interface HomeAddAccountButtonProps {
  className?: string;
  canCreateTeamAccount?: {
    allowed: boolean;
    reason?: string;
  };
}

export function HomeAddAccountButton(props: HomeAddAccountButtonProps) {
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  const canCreate = props.canCreateTeamAccount?.allowed ?? true;
  const reason = props.canCreateTeamAccount?.reason;

  const button = (
    <Button
      className={props.className}
      onClick={() => setIsAddingAccount(true)}
      disabled={!canCreate}
    >
      <Trans i18nKey={'account:createTeamButtonLabel'} />
    </Button>
  );

  return (
    <>
      {!canCreate && reason ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-not-allowed">{button}</span>
            </TooltipTrigger>
            <TooltipContent>
              <Trans i18nKey={reason} defaults={reason} />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      <CreateTeamAccountDialog
        isOpen={isAddingAccount}
        setIsOpen={setIsAddingAccount}
      />
    </>
  );
}
