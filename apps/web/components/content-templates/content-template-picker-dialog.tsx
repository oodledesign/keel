'use client';

import { useEffect, useState, useTransition } from 'react';

import { FileText, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

import { listTemplatesPickerAction } from '~/lib/content-templates/account.actions';
import type {
  ContentTemplateKind,
  PickerTemplate,
} from '~/lib/content-templates/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ContentTemplateKind;
  accountId?: string | null;
  title?: string;
  onSelect: (template: PickerTemplate) => void;
};

export function ContentTemplatePickerDialog({
  open,
  onOpenChange,
  kind,
  accountId,
  title = 'Choose template',
  onSelect,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<PickerTemplate[]>([]);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      try {
        const rows = await listTemplatesPickerAction({
          kind,
          accountId: accountId ?? null,
        });
        setItems(rows);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not load templates',
        );
        setItems([]);
      }
    });
  }, [accountId, kind, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {pending && items.length === 0 ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No templates found.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={`${item.source}:${item.id}`}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start gap-2 py-3 text-left"
                  onClick={() => {
                    onSelect(item);
                    onOpenChange(false);
                  }}
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {item.name}
                      {item.isDefault ? ' · default' : ''}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {item.source}
                      {item.description ? ` · ${item.description}` : ''}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
