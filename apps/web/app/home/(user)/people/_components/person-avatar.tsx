import Image from 'next/image';

import { cn } from '@kit/ui/utils';

import { circleTierBadgeClass } from '../_lib/circle-tiers';
import type { PersonCircleTier } from '../_lib/schema/people.schema';

type PersonAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  tier?: PersonCircleTier;
  className?: string;
  /** Square corners with slight rounding (default). Set false for circle. */
  square?: boolean;
};

const SIZE_CLASS = {
  xs: 'h-8 w-8 text-xs',
  sm: 'h-10 w-10 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-16 w-16 text-xl',
} as const;

const TIER_RING_CLASS: Record<PersonCircleTier, string> = {
  core: 'ring-[var(--keel-teal)]/40',
  close: 'ring-[#2563EB]/35',
  friends: 'ring-violet-400/30',
  community: 'ring-white/20',
};

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export function PersonAvatar({
  name,
  avatarUrl,
  size = 'md',
  tier,
  className,
  square = true,
}: PersonAvatarProps) {
  const sizeClass = SIZE_CLASS[size];
  const initials = getInitials(name);
  const shapeClass = square ? 'rounded-lg' : 'rounded-full';

  if (avatarUrl?.trim()) {
    return (
      <span
        className={cn(
          'relative inline-flex shrink-0 overflow-hidden ring-2',
          shapeClass,
          sizeClass,
          tier ? TIER_RING_CLASS[tier] : 'ring-white/10',
          className,
        )}
      >
        <Image
          src={avatarUrl}
          alt=""
          fill
          unoptimized
          className="object-cover"
          sizes="64px"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold ring-2 ring-inset ring-white/10',
        shapeClass,
        sizeClass,
        tier ? circleTierBadgeClass(tier) : 'bg-[var(--keel-teal)]/15 text-[#5eead4]',
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
