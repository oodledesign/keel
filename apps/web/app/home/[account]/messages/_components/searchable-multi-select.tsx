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

export type SearchableMultiSelectOption = {
  value: string;
  label: string;
  /** Extra text included in cmdk search (e.g. email). */
  searchText?: string;
};

export function SearchableMultiSelect({
  options,
  values,
  onValuesChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches.',
  disabled,
  id,
}: {
  options: SearchableMultiSelectOption[];
  values: string[];
  onValuesChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);

  const labelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) {
      m.set(o.value, o.label);
    }
    return m;
  }, [options]);

  const summary = useMemo(() => {
    if (values.length === 0) return null;
    const labels = values
      .map((v) => labelByValue.get(v))
      .filter((x): x is string => Boolean(x));
    if (labels.length <= 3) return labels.join(', ');
    return `${values.length} selected`;
  }, [values, labelByValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || options.length === 0}
          className={cn(
            'min-h-10 w-full justify-between border-[color:var(--workspace-shell-border)] bg-black/30 px-3 py-2 text-left font-normal text-[var(--workspace-shell-text)] hover:bg-black/40 hover:text-[var(--workspace-shell-text)]',
            !summary && 'text-[var(--workspace-shell-text-muted)]',
          )}
        >
          <span className="line-clamp-2 flex-1 pr-2">
            {summary ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] border-[color:var(--workspace-shell-border)] bg-[#1f2c34] p-0"
        align="start"
      >
        <Command className="bg-[#1f2c34]">
          <CommandInput
            placeholder={searchPlaceholder}
            className="border-[color:var(--workspace-shell-border)] bg-black/30 text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
          />
          <CommandList className="max-h-56">
            <CommandEmpty className="py-3 text-center text-xs text-[var(--workspace-shell-text-muted)]">
              {emptyMessage}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const selected = values.includes(opt.value);
                const filterValue = `${opt.value} ${opt.label} ${opt.searchText ?? ''}`;
                return (
                  <CommandItem
                    key={opt.value}
                    value={filterValue}
                    onSelect={() => {
                      onValuesChange(
                        selected
                          ? values.filter((v) => v !== opt.value)
                          : [...values, opt.value],
                      );
                    }}
                    className="text-[var(--workspace-shell-text)] aria-selected:bg-[var(--workspace-shell-sidebar-accent)]"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0 text-[var(--brand-green-500)]',
                        selected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
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
