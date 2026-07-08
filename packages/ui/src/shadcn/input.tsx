import * as React from 'react';

import { cn } from '../lib/utils';

export type InputProps = React.ComponentPropsWithRef<'input'>;

const Input: React.FC<InputProps> = ({
  className,
  type = 'text',
  ...props
}) => {
  return (
    <input
      type={type}
      className={cn(
        'border-input file:text-foreground hover:border-ring/50 placeholder:text-muted-foreground flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-2xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-[var(--ozer-accent)]/50 focus-visible:ring-0 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  );
};

Input.displayName = 'Input';

export { Input };
