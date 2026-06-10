import { APP_THEME } from './app-theme';

/**
 * @name getRootTheme
 * @description Keel is locked to dark mode for app and PWA.
 */
export async function getRootTheme() {
  return APP_THEME;
}
