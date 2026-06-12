'use client';

import Link from 'next/link';

import { triggerHapticFeedback } from '~/lib/haptics';

type HapticLinkProps = React.ComponentProps<typeof Link>;

export function HapticLink({ onClick, prefetch = false, ...props }: HapticLinkProps) {
  return (
    <Link
      {...props}
      prefetch={prefetch}
      onClick={(event) => {
        triggerHapticFeedback();
        onClick?.(event);
      }}
    />
  );
}

type HapticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function HapticButton({ onClick, type = 'button', ...props }: HapticButtonProps) {
  return (
    <button
      {...props}
      type={type}
      onClick={(event) => {
        triggerHapticFeedback();
        onClick?.(event);
      }}
    />
  );
}
