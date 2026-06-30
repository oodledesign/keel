import appConfig from '~/config/app.config';

/** Default theme when no user preference is stored (env: NEXT_PUBLIC_DEFAULT_THEME_MODE). */
export const APP_DEFAULT_THEME = appConfig.theme;

/** localStorage key used by next-themes */
export const APP_THEME_STORAGE_KEY = 'ozer-theme';

export type AppThemeMode = 'light' | 'dark' | 'system';

/** @deprecated Use APP_DEFAULT_THEME or useTheme() — kept for callers not yet migrated */
export const APP_THEME = 'dark' as const;

export type AppTheme = typeof APP_THEME;
