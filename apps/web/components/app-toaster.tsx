'use client';

import { Toaster } from '@kit/ui/sonner';
import { useTheme } from 'next-themes';

export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      richColors
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      position="top-center"
    />
  );
}
