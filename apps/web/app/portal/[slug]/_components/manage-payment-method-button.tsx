'use client';

import { useTransition } from 'react';

import { CreditCard, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { createPortalManagePaymentSessionAction } from '../_lib/server/server-actions';

export function ManagePaymentMethodButton({
  clientOrgId,
  clientSlug,
}: {
  clientOrgId: string;
  clientSlug: string;
}) {
  const [pending, startTransition] = useTransition();

  function openPortal() {
    startTransition(async () => {
      try {
        const { url } = await createPortalManagePaymentSessionAction({
          clientOrgId,
          clientSlug,
        });
        window.location.assign(url);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not open payment settings',
        );
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={openPortal}
    >
      {pending ? (
        <Loader2 className="mr-1 size-4 animate-spin" />
      ) : (
        <CreditCard className="mr-1 size-4" />
      )}
      Manage payment method
    </Button>
  );
}
