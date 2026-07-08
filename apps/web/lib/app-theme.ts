import appConfig from '~/config/app.config';

/** Default theme when no user preference is stored (env: NEXT_PUBLIC_DEFAULT_THEME_MODE). */
export const APP_DEFAULT_THEME = appConfig.theme;

/** localStorage key used by next-themes (prefer ozer-; migrate from keel- on read) */
export const APP_THEME_STORAGE_KEY = 'ozer-theme';
const LEGACY_THEME_STORAGE_KEY = 'keel-theme';

/** One-time migrate theme preference from keel-theme → ozer-theme. */
export function migrateThemeStorageKey(): void {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(APP_THEME_STORAGE_KEY)) return;
  const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (!legacy) return;
  window.localStorage.setItem(APP_THEME_STORAGE_KEY, legacy);
  window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
}

export type AppThemeMode = 'light' | 'dark' | 'system';

/** @deprecated Use APP_DEFAULT_THEME or useTheme() — kept for callers not yet migrated */
export const APP_THEME = 'dark' as const;

export type AppTheme = typeof APP_THEME;
