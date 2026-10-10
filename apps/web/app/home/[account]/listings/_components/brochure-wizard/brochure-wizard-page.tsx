'use client';

import type { ComponentProps } from 'react';

import { useRouter } from 'next/navigation';

import { BrochureWizard } from './brochure-wizard';

/** The wizard as its own page; closing returns to the listing's Publishing tab. */
export function BrochureWizardPage({
  returnHref,
  ...wizard
}: Omit<ComponentProps<typeof BrochureWizard>, 'onClose'> & {
  returnHref: string;
}) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50">
      <BrochureWizard {...wizard} onClose={() => router.push(returnHref)} />
    </div>
  );
}
