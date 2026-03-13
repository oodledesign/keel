'use client';

import { useMemo, useState } from 'react';

import { Check, ChevronsUpDown } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@kit/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

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
  const displayValue = selected ? selected.display_name ?? selected.id : null;

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
              'w-full justify-between border-zinc-600 bg-[var(--workspace-shell-panel)] text-white hover:bg-[var(--workspace-shell-panel-hover)] hover:text-white',
              !displayValue && 'text-zinc-500',
            )}
          >
            {loading ? 'Loading…' : displayValue ?? placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] border-zinc-700 bg-[var(--workspace-shell-panel)] p-0"
          align="start"
        >
          <Command className="bg-[var(--workspace-shell-panel)]">
            <CommandInput
              placeholder="Search clients…"
              className="border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500"
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="None"
                  onSelect={() => {
                    onValueChange('');
                    setOpen(false);
                  }}
                  className="text-zinc-300 aria-selected:bg-zinc-800"
                >
                  <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
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
                      className="text-zinc-300 aria-selected:bg-zinc-800"
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
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
        <p className="text-sm text-zinc-500">
          No clients in this account yet.{' '}
          <a href={addClientHref} className="text-zinc-400 underline hover:text-white">
            Add a client
          </a>
        </p>
      )}
    </div>
  );
}
