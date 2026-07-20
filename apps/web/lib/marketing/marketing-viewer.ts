import type { JWTUserData } from '@kit/supabase/types';

export type MarketingViewerContext = {
  isAuthenticated: boolean;
  firstName: string | null;
  dashboardHref: string;
  greeting: string;
  dateLabel: string;
};

export function getTimeOfDayGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatMarketingDateLabel(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);
}

export function toMarketingFirstName(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  const base = raw.trim().split(/\s+/)[0];
  if (!base) return null;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function resolveMarketingViewerFirstName(
  user: JWTUserData,
): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const displayNameRaw =
    (typeof meta?.display_name === 'string' && meta.display_name.trim()) ||
    (typeof meta?.name === 'string' && meta.name.trim()) ||
    (typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
    user.email?.split('@')[0] ||
    '';

  return toMarketingFirstName(displayNameRaw);
}

export function formatMarketingDashboardGreeting(
  greeting: string,
  firstName: string | null,
): string {
  return firstName ? `${greeting}, ${firstName}` : greeting;
}
