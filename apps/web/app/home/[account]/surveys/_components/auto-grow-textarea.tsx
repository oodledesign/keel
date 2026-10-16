'use client';

import { useLayoutEffect, useRef } from 'react';

import { Textarea, type TextareaProps } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

/**
 * Textarea that grows with its content so the field itself does not scroll.
 */
export function AutoGrowTextarea({
  value,
  className,
  onChange,
  ...props
}: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.overflow = 'hidden';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    fit();
  }, [value]);

  return (
    <Textarea
      ref={ref}
      value={value}
      className={cn('resize-none overflow-hidden', className)}
      onChange={(event) => {
        onChange?.(event);
        fit();
      }}
      {...props}
    />
  );
}
