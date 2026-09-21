'use client';

import { Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { CreateProjectDialog } from '~/home/[account]/projects/_components/create-project-dialog';

export function CreateClientProjectButton({
  onClick,
  className,
  label = 'Create project',
}: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]',
        className,
      )}
      onClick={onClick}
    >
      <Plus className="mr-1.5 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

export function CreateClientProjectDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  clientId,
  clientName,
  onSuccess,
  projectDetailPathBuilder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  clientId: string;
  clientName?: string;
  onSuccess: () => void;
  projectDetailPathBuilder?: (id: string) => string;
}) {
  return (
    <CreateProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      accountId={accountId}
      accountSlug={accountSlug}
      hideTypePicker
      lockClient
      lockedClientLabel={clientName}
      defaults={{ clientId }}
      projectDetailPathBuilder={projectDetailPathBuilder}
      dialogDescription={
        clientName
          ? `Create a delivery project already linked to ${clientName}.`
          : 'Create a delivery project already linked to this client.'
      }
      onSuccess={onSuccess}
    />
  );
}
