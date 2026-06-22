'use client';

import { Sheet, SheetContent } from '@kit/ui/sheet';

import type { CreateInitialValues } from './client-form';
import { ClientForm } from './client-form';

export function ClientDetailDrawer({
  open,
  onOpenChange,
  accountId,
  createInitialValues,
  canEditClients,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  /** Prefill for create form (e.g. from pipeline deal won). */
  createInitialValues?: CreateInitialValues;
  canEditClients: boolean;
  onSaved: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl"
      >
        <div className="mt-6 space-y-6">
          <ClientForm
            accountId={accountId}
            mode="create"
            initialValues={createInitialValues}
            onSaved={onSaved}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
