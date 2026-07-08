import * as React from 'react';

import { cn } from '../lib/utils';

export type TextareaProps = React.ComponentPropsWithRef<'textarea'>;

const Textarea: React.FC<TextareaProps> = ({ className, ...props }) => {
  return (
    <textarea
      className={cn(
        'border-input placeholder:text-muted-foreground flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-[var(--ozer-accent)]/50 focus-visible:ring-0 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
};

Textarea.displayName = 'Textarea';

export { Textarea };
