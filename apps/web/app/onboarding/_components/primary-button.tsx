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
          : 'w-full bg-emerald-600 text-white hover:bg-emerald-500'
      }
      {...props}
    >
      {children}
    </Button>
  );
}
