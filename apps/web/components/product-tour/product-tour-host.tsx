'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import { isPersonalDashboardRoot } from '~/lib/dashboard-shortcuts/personal-home-url';
import { resolveTeamProductTourId } from '~/lib/product-tour/tour-steps';
import {
  type CompletedProductTours,
  type DriveableProductTourId,
  hasCompletedProductTour,
} from '~/lib/product-tour/types';

const ProductTour = dynamic(
  () =>
    import('~/components/product-tour/product-tour').then((m) => m.ProductTour),
  { ssr: false },
);

type WorkspaceOption = { slug: string; name: string };

type PersonalProductTourHostProps = {
  variant: 'personal';
  completedTours: CompletedProductTours;
  workspaceOptions: WorkspaceOption[];
};

type TeamProductTourHostProps = {
  variant: 'team';
  completedTours: CompletedProductTours;
  workspaceProfile: string;
  accountSlug: string;
  onboardingCompleted: boolean;
  workspaceOptions: WorkspaceOption[];
};

function isTeamAccountHome(pathname: string, accountSlug: string) {
  const normalized = pathname.replace(/\/$/, '') || '/';
  const expected = pathsConfig.app.accountHome
    .replace('[account]', accountSlug)
    .replace(/\/$/, '');
  // Public URLs are /app/...; filesystem routes are /home/... (rewrites).
  const legacyHome = `/home/${accountSlug}`;
  return normalized === expected || normalized === legacyHome;
}

function isOnboardingOrSetupPath(pathname: string) {
  return pathname.includes('/onboarding') || pathname.includes('/setup');
}

export function ProductTourHost(
  props: PersonalProductTourHostProps | TeamProductTourHostProps,
) {
  const pathname = usePathname() ?? '';

  if (isOnboardingOrSetupPath(pathname)) {
    return null;
  }

  let tourId: DriveableProductTourId | null = null;
  let autoStart = false;
  let preferredWorkspaceSlug: string | null = null;

  if (props.variant === 'personal') {
    if (!isPersonalDashboardRoot(pathname)) {
      return null;
    }
    tourId = 'personal';
    autoStart = !hasCompletedProductTour(props.completedTours, 'personal');
  } else {
    if (
      !props.onboardingCompleted ||
      !isTeamAccountHome(pathname, props.accountSlug)
    ) {
      return null;
    }
    tourId = resolveTeamProductTourId(props.workspaceProfile);
    if (!tourId) return null;
    autoStart = !hasCompletedProductTour(props.completedTours, tourId);
    preferredWorkspaceSlug = props.accountSlug;
  }

  const showDefaultLandingPrompt =
    props.workspaceOptions.length > 0 &&
    !hasCompletedProductTour(props.completedTours, 'default_landing_prompt');

  // Keep mounted after the tour finishes so the default-landing dialog can show
  // (marking the tour complete revalidates and would otherwise unmount it).
  if (!tourId || (!autoStart && !showDefaultLandingPrompt)) {
    return null;
  }

  return (
    <ProductTour
      tourId={tourId}
      autoStart={autoStart}
      showDefaultLandingPrompt={showDefaultLandingPrompt}
      workspaceOptions={props.workspaceOptions}
      preferredWorkspaceSlug={preferredWorkspaceSlug}
    />
  );
}
