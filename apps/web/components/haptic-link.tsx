'use client';

import Link from 'next/link';

type HapticLinkProps = React.ComponentProps<typeof Link>;

/** Semantic link wrapper — haptics handled by MobileTapHaptics in mobile chrome. */
export function HapticLink({ prefetch = false, ...props }: HapticLinkProps) {
  return <Link {...props} prefetch={prefetch} />;
}

type HapticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/** Semantic button wrapper — haptics handled by MobileTapHaptics in mobile chrome. */
export function HapticButton({ type = 'button', ...props }: HapticButtonProps) {
  return <button {...props} type={type} />;
}
