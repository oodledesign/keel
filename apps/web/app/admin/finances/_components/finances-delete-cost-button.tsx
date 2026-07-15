'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import { deleteOperatingCostAction } from '../_lib/server/finances.actions';

export function FinancesDeleteCostButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await deleteOperatingCostAction({ id });
          toast.success('Removed');
          router.refresh();
        } catch (error) {
          toast.error(getErrorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
