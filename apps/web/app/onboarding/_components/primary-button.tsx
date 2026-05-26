'use client';

import { Button } from '@kit/ui/button';

interface PrimaryButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  asChild?: boolean;
}

export function PrimaryButton({
  children,
  className,
  ...props
}: PrimaryButtonProps) {
  return (
    <Button
      className={
        className
          ? className
          : 'w-full bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]'
      }
      {...props}
    >
      {children}
    </Button>
  );
}
