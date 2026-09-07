'use client';

import { ChevronDown } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { cn } from '@kit/ui/utils';

import {
  WORKSPACE_FORM_FIELD_TYPE_GROUPS,
  WORKSPACE_FORM_FIELD_TYPE_LABELS,
  type WorkspaceFormFieldType,
} from '~/lib/workspace-forms/form-fields';
import {
  workspaceSelectContentClass,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { FormFieldTypeIcon } from './form-field-type-icon';

type Props = {
  value?: WorkspaceFormFieldType;
  placeholder?: string;
  onSelect: (type: WorkspaceFormFieldType) => void;
  triggerClassName?: string;
  testId?: string;
};

export function FormFieldTypePicker({
  value,
  placeholder = 'Add field',
  onSelect,
  triggerClassName,
  testId,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-9 justify-between gap-2 rounded-xl px-3 font-normal',
            triggerClassName,
          )}
          data-test={testId}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            {value ? (
              <>
                <FormFieldTypeIcon
                  type={value}
                  className={`h-4 w-4 shrink-0 ${workspaceTextMuted}`}
                />
                <span className={`truncate ${workspaceText}`}>
                  {WORKSPACE_FORM_FIELD_TYPE_LABELS[value]}
                </span>
              </>
            ) : (
              <span className={workspaceTextMuted}>{placeholder}</span>
            )}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 ${workspaceTextMuted}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(workspaceSelectContentClass, 'w-64 p-1')}
      >
        {WORKSPACE_FORM_FIELD_TYPE_GROUPS.map((group, index) => (
          <div key={group.id}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            {group.types.map((type) => (
              <DropdownMenuItem
                key={type}
                onSelect={() => onSelect(type)}
                className="gap-2.5"
                data-test={`form-field-type-${type}`}
              >
                <FormFieldTypeIcon
                  type={type}
                  className={`h-4 w-4 ${workspaceTextMuted}`}
                />
                {WORKSPACE_FORM_FIELD_TYPE_LABELS[type]}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
