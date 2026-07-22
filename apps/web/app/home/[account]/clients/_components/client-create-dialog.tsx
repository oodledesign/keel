'use client';

import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import pathsConfig from '~/config/paths.config';

import type { CreateInitialValues } from './client-form';
import { ClientForm } from './client-form';

export function ClientCreateDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  createInitialValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  /** Prefill for create form (e.g. from pipeline deal won). */
  createInitialValues?: CreateInitialValues;
  onSaved: () => void;
}) {
  const importHref = pathsConfig.app.accountClientsImport.replace(
    '[account]',
    accountSlug,
  );
  const linkedInImportHref = `${pathsConfig.app.accountLinkedInImport.replace(
    '[account]',
    accountSlug,
  )}?destination=clients`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create client</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Or{' '}
            <Link
              href={importHref}
              className="font-medium text-[var(--ozer-accent)] hover:underline"
              onClick={() => onOpenChange(false)}
            >
              upload via CSV
            </Link>
            {' · '}
            <Link
              href={linkedInImportHref}
              className="font-medium text-[var(--ozer-accent)] hover:underline"
              onClick={() => onOpenChange(false)}
            >
              import from LinkedIn
            </Link>
          </DialogDescription>
        </DialogHeader>
        <ClientForm
          accountId={accountId}
          mode="create"
          initialValues={createInitialValues}
          onSaved={onSaved}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
