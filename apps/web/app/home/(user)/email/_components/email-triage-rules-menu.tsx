'use client';

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@kit/ui/dropdown-menu';

import type {
  EmailTriageAction,
  EmailTriageScope,
} from '~/lib/email-assistant/email-triage-rules.shared';
import { truncateSubjectLabel } from '~/lib/email-assistant/email-triage-rules.shared';

type Props = {
  subject?: string | null;
  disabled?: boolean;
  onSelectRule: (action: EmailTriageAction, scope: EmailTriageScope) => void;
};

export function EmailTriageRulesMenuItems({
  subject,
  disabled,
  onSelectRule,
}: Props) {
  const subjectLabel = truncateSubjectLabel(subject);

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={disabled}>
          Always…
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-w-xs">
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => onSelectRule('ignore', 'sender')}
          >
            Ignore this sender
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => onSelectRule('ignore', 'domain')}
          >
            Ignore this domain
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => onSelectRule('ignore', 'subject')}
          >
            Ignore subject containing {subjectLabel}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => onSelectRule('priority', 'sender')}
          >
            Always needs reply from this sender
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => onSelectRule('priority', 'domain')}
          >
            Always needs reply from this domain
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => onSelectRule('priority', 'subject')}
          >
            Always needs reply for subject containing {subjectLabel}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}
