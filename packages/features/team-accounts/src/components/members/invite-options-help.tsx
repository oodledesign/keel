'use client';

import { ChevronDown } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

/**
 * Expandable copy explaining invite role (and commercial seat type) choices.
 */
export function InviteOptionsHelp({
  showSeatKind = false,
  className,
}: {
  showSeatKind?: boolean;
  className?: string;
}) {
  return (
    <Collapsible
      className={cn('group bg-muted/20 rounded-lg border', className)}
    >
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium transition-colors">
        <span>
          {showSeatKind ? (
            <Trans i18nKey="teams:inviteOptionsHelpTitle" />
          ) : (
            <Trans i18nKey="teams:inviteOptionsHelpRolesOnlyTitle" />
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="text-muted-foreground space-y-3 border-t px-3 py-2.5 text-sm">
        <div className="space-y-1.5">
          {showSeatKind ? (
            <p className="text-foreground font-medium">
              <Trans i18nKey="teams:inviteOptionsHelpRolesTitle" />
            </p>
          ) : null}
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <Trans i18nKey="teams:inviteOptionsHelpAdmin" />
            </li>
            <li>
              <Trans i18nKey="teams:inviteOptionsHelpTeam" />
            </li>
          </ul>
        </div>

        {showSeatKind ? (
          <div className="space-y-1.5">
            <p className="text-foreground font-medium">
              <Trans i18nKey="teams:inviteOptionsHelpSeatsTitle" />
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <Trans i18nKey="teams:inviteOptionsHelpBillable" />
              </li>
              <li>
                <Trans i18nKey="teams:inviteOptionsHelpSupport" />
              </li>
            </ul>
            <p className="text-foreground/90 pt-0.5 text-xs">
              <Trans i18nKey="teams:inviteOptionsHelpTip" />
            </p>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
