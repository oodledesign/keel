'use client';

import { useEffect, useState } from 'react';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

type ThemeModeToggleProps = {
  className?: string;
};

/**
 * Compact light/dark toggle for marketing chrome.
 * Theme preference is shared with the app via `ozer-theme` localStorage.
 */
export function ThemeModeToggle({ className }: ThemeModeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('size-9 shrink-0', className)}
        aria-hidden
        tabIndex={-1}
      />
    );
  }

  const isDark = resolvedTheme !== 'light';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'size-9 shrink-0 text-[var(--workspace-shell-text-muted)] transition-transform duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]',
        className,
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
