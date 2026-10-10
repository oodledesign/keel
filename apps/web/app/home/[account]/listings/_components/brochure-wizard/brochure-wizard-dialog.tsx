'use client';

import type { ComponentProps } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@kit/ui/dialog';

import { BrochureWizard } from './brochure-wizard';

type BrochureWizardProps = Omit<
  ComponentProps<typeof BrochureWizard>,
  'onClose'
>;

export function BrochureWizardDialog({
  open,
  onOpenChange,
  ...wizard
}: BrochureWizardProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        // Closing goes through the wizard so pending edits are saved first.
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 top-0 left-0 block h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 p-0 sm:w-screen sm:max-w-none sm:rounded-none"
      >
        <DialogTitle className="sr-only">Brochure</DialogTitle>
        {open ? (
          <BrochureWizard {...wizard} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
