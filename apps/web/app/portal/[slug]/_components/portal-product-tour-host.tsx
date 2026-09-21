'use client';

import dynamic from 'next/dynamic';

import {
  type CompletedProductTours,
  hasCompletedProductTour,
} from '~/lib/product-tour/types';

const ProductTour = dynamic(
  () =>
    import('~/components/product-tour/product-tour').then((m) => m.ProductTour),
  { ssr: false },
);

export function PortalProductTourHost({
  completedTours,
}: {
  completedTours: CompletedProductTours;
}) {
  const autoStart = !hasCompletedProductTour(completedTours, 'client_portal');
  if (!autoStart) return null;

  return (
    <ProductTour
      tourId="client_portal"
      autoStart
      showDefaultLandingPrompt={false}
      workspaceOptions={[]}
    />
  );
}
