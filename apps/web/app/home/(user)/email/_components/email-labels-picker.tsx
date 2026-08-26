'use client';

import { useMemo, useState, useTransition } from 'react';

import { Check, Tags } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { modifyEmailThreadLabelsAction } from '~/lib/email-assistant/email-assistant.actions';

import type { EmailGmailLabel } from '../_lib/types';

type EmailLabelsPickerProps = {
  threadId: string;
  labelIds: string[];
  labels: EmailGmailLabel[];
  onLabelsChange?: (labelIds: string[]) => void;
};

export function EmailLabelsPicker({
  threadId,
  labelIds,
  labels,
  onLabelsChange,
}: EmailLabelsPickerProps) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');

  const pickerLabels = useMemo(
    () =>
      labels
        .filter(
          (label) => label.type === 'user' && !label.name.startsWith('Ozer/'),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [labels],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pickerLabels;
    return pickerLabels.filter((label) => label.name.toLowerCase().includes(q));
  }, [pickerLabels, query]);

  const active = new Set(labelIds);

  function toggle(labelId: string, currentlyOn: boolean) {
    startTransition(async () => {
      try {
        const result = await modifyEmailThreadLabelsAction({
          threadId,
          addLabelIds: currentlyOn ? [] : [labelId],
          removeLabelIds: currentlyOn ? [labelId] : [],
        });

        if (result.labelIds) {
          onLabelsChange?.(result.labelIds);
        }

        if (result.warning) {
          toast.message(result.warning);
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update labels',
        );
      }
    });
  }

  if (pickerLabels.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={pending}
        >
          <Tags className="h-3.5 w-3.5" />
          Labels
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Gmail labels</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search labels…"
            className="h-8"
          />
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No matching labels
            </p>
          ) : (
            filtered.map((label) => {
              const on = active.has(label.id);
              return (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={on}
                  onCheckedChange={() => toggle(label.id, on)}
                  disabled={pending}
                >
                  <span className="flex items-center gap-2 truncate">
                    {on ? <Check className="h-3 w-3 shrink-0" /> : null}
                    <span className="truncate">{label.name}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
