'use client';

import { useMemo, useState } from 'react';

import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@kit/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { cn } from '@kit/ui/utils';

import {
  workspaceComboboxInputClass,
  workspaceComboboxItemClass,
  workspaceComboboxListClass,
  workspaceComboboxPopoverClass,
} from '~/components/workspace-shell/workspace-combobox-styles';

export type MeetingContactOption = {
  id: string;
  full_name: string;
  email: string | null;
};

export function CreateMeetingContactCombobox({
  contacts,
  value,
  onValueChange,
  loading,
  disabled,
  placeholder = 'Search contacts…',
  emptyMessage = 'No matching contacts.',
}: {
  contacts: MeetingContactOption[];
  value: string;
  onValueChange: (contactId: string) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => (value ? contacts.find((contact) => contact.id === value) : null),
    [contacts, value],
  );

  const displayValue = selected
    ? `${selected.full_name}${selected.email ? ` · ${selected.email}` : ''}`
    : null;

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            'w-full justify-between border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)] focus-visible:ring-0 focus-visible:ring-offset-0',
            !displayValue && 'text-[var(--workspace-shell-text-muted)]',
          )}
        >
          {loading ? 'Loading…' : (displayValue ?? placeholder)}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(workspaceComboboxPopoverClass, 'z-[60]')}
        align="start"
      >
        <Command className="bg-[var(--workspace-shell-panel)] [&_[cmdk-input-wrapper]]:border-[color:var(--workspace-shell-border)]">
          <CommandInput
            placeholder={placeholder}
            className={workspaceComboboxInputClass}
          />
          <CommandList className={workspaceComboboxListClass}>
            <CommandEmpty>
              {contacts.length === 0
                ? 'No contacts with email in this account yet.'
                : emptyMessage}
            </CommandEmpty>
            <CommandGroup>
              {contacts.map((contact) => {
                const label = `${contact.full_name}${
                  contact.email ? ` ${contact.email}` : ''
                }`;
                return (
                  <CommandItem
                    key={contact.id}
                    value={label}
                    onSelect={() => {
                      onValueChange(contact.id);
                      setOpen(false);
                    }}
                    className={workspaceComboboxItemClass}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === contact.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{contact.full_name}</span>
                      {contact.email ? (
                        <span className="text-[var(--workspace-shell-text-muted)]">
                          {' '}
                          · {contact.email}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
