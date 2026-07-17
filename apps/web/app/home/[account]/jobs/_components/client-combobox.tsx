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

export type ClientOption = { id: string; display_name: string | null };

export function ClientCombobox({
  clients,
  value,
  onValueChange,
  loading,
  disabled,
  placeholder = 'Select client',
  emptyMessage = 'No clients found.',
  addClientHref,
}: {
  clients: ClientOption[];
  value: string;
  onValueChange: (clientId: string) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  addClientHref?: string;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => (value ? clients.find((c) => c.id === value) : null),
    [clients, value],
  );
  const displayValue = selected ? (selected.display_name ?? selected.id) : null;

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
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
        <PopoverContent className={workspaceComboboxPopoverClass} align="start">
          <Command className="bg-[var(--workspace-shell-panel)] [&_[cmdk-input-wrapper]]:border-[color:var(--workspace-shell-border)]">
            <CommandInput
              placeholder="Search clients…"
              className={workspaceComboboxInputClass}
            />
            <CommandList
              className={workspaceComboboxListClass}
              onWheel={(event) => event.stopPropagation()}
            >
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="None"
                  onSelect={() => {
                    onValueChange('');
                    setOpen(false);
                  }}
                  className={cn(
                    workspaceComboboxItemClass,
                    'text-[var(--workspace-shell-text-muted)]',
                  )}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      !value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  None
                </CommandItem>
                {clients.map((c) => {
                  const label = c.display_name ?? c.id;
                  return (
                    <CommandItem
                      key={c.id}
                      value={label}
                      onSelect={() => {
                        onValueChange(c.id);
                        setOpen(false);
                      }}
                      className={workspaceComboboxItemClass}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === c.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!loading && clients.length === 0 && addClientHref && (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No clients in this account yet.{' '}
          <a
            href={addClientHref}
            className="text-[var(--workspace-shell-text-muted)] underline hover:text-[var(--workspace-shell-text)]"
          >
            Add a client
          </a>
        </p>
      )}
    </div>
  );
}
