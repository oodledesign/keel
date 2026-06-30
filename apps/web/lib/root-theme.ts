import appConfig from '~/config/app.config';

/**
 * Server default for ThemeProvider before client hydration.
 * User choice is persisted in localStorage by next-themes.
 */
export async function getRootTheme() {
  return appConfig.theme;
}
