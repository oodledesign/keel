'use client';

import { Sheet, SheetContent } from '@kit/ui/sheet';

import type { CreateInitialValues } from './client-form';
import { ClientForm } from './client-form';
import { ClientDetailSidebar } from './client-detail-sidebar';

export function ClientDetailDrawer({
  open,
  onOpenChange,
  accountSlug,
  accountId,
  clientId,
  createNew,
  createInitialValues,
  canEditClients,
  isContractorView,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountSlug: string;
  accountId: string;
  clientId: string | null;
  createNew: boolean;
  /** Prefill for create form (e.g. from pipeline deal won). */
  createInitialValues?: CreateInitialValues;
  canEditClients: boolean;
  isContractorView: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  if (!createNew && clientId) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-hidden border-zinc-700 bg-[var(--workspace-shell-panel)] p-0 sm:max-w-md"
        >
          <ClientDetailSidebar
            accountSlug={accountSlug}
            accountId={accountId}
            clientId={clientId}
            canEditClients={canEditClients}
            isContractorView={isContractorView}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
            onDeleted={onDeleted}
          />
        </SheetContent>
      </Sheet>
    );
  }

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
