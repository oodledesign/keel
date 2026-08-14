'use client';

import { ReplayProductTourButton } from '~/components/product-tour/product-tour';
import type { DriveableProductTourId } from '~/lib/product-tour/types';

type ProductTourSettingsCardProps = {
  tourId: DriveableProductTourId;
  accountSlug?: string | null;
};

export function ProductTourSettingsCard({
  tourId,
  accountSlug,
}: ProductTourSettingsCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
      <div>
        <h2 className="text-base font-semibold">Product tour</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Walk through the main areas again anytime.
        </p>
      </div>
      <div>
        <ReplayProductTourButton tourId={tourId} accountSlug={accountSlug} />
      </div>
    </div>
  );
}
