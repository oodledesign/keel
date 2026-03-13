import { Poppins } from 'next/font/google';

import { cn } from '@kit/ui/utils';

const sans = Poppins({
  subsets: ['latin'],
  variable: '--font-sans-fallback',
  fallback: ['system-ui', 'Helvetica Neue', 'Helvetica', 'Arial'],
  preload: true,
  weight: ['400', '500', '600', '700', '800'],
});

const heading = Poppins({
  subsets: ['latin'],
  variable: '--font-heading-fallback',
  fallback: ['system-ui', 'Helvetica Neue', 'Helvetica', 'Arial'],
  preload: true,
  weight: ['400', '500', '600', '700', '800'],
});

// we export these fonts into the root layout
export { sans, heading };

/**
 * @name getFontsClassName
 * @description Get the class name for the root layout.
 * @param theme
 */
export function getFontsClassName(theme?: string) {
  const dark = theme === 'dark';
  const light = !dark;

  const font = [sans.variable, heading.variable].reduce<string[]>(
    (acc, curr) => {
      if (acc.includes(curr)) return acc;

      return [...acc, curr];
    },
    [],
  );

  return cn(...font, {
    dark,
    light,
  });
}
