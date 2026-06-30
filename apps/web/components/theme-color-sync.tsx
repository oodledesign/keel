'use client';

import { useEffect } from 'react';

import { useTheme } from 'next-themes';

import appConfig from '~/config/app.config';
import { brandConfig } from '~/config/brand.config';

/**
 * Keeps theme-color meta in sync with resolved light/dark mode (PWA + browser chrome).
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color =
      resolvedTheme === 'light'
        ? (appConfig.themeColor ?? brandConfig.colors.canvas.light)
        : (appConfig.themeColorDark ?? brandConfig.colors.canvas.dark);

    let meta = document.querySelector('meta[name="theme-color"]');

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }

    meta.setAttribute('content', color);
  }, [resolvedTheme]);

  return null;
}
