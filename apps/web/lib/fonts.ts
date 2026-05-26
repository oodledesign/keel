import { Inter } from 'next/font/google';

import { cn } from '@kit/ui/utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans-fallback',
  fallback: ['system-ui', 'Helvetica Neue', 'Helvetica', 'Arial'],
  preload: true,
  weight: ['400', '500', '700'],
});

// Inter for both body and headings (Keel brand)
export const sans = inter;
export const heading = inter;

/**
 * @name getFontsClassName
 * @description Get the class name for the root layout.
 */
export function getFontsClassName(theme?: string) {
  const dark = theme === 'dark';
  const light = !dark;

  return cn(inter.variable, {
    dark,
    light,
  });
}
