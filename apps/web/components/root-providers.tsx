'use client';

import { useMemo } from 'react';

import { ThemeProvider } from 'next-themes';

import { I18nProvider } from '@kit/i18n/provider';
import { MonitoringProvider } from '@kit/monitoring/components';
import { AppEventsProvider } from '@kit/shared/events';
import { If } from '@kit/ui/if';
import { VersionUpdater } from '@kit/ui/version-updater';

import { AnalyticsProvider } from '~/components/analytics-provider';
import { AuthProvider } from '~/components/auth-provider';
import { QuickActionProvider } from '~/components/quick-action/quick-action-provider';
import { ThemeColorSync } from '~/components/theme-color-sync';
import featuresFlagConfig from '~/config/feature-flags.config';
import { APP_DEFAULT_THEME, APP_THEME_STORAGE_KEY, migrateThemeStorageKey } from '~/lib/app-theme';
import { i18nResolver } from '~/lib/i18n/i18n.resolver';
import { getI18nSettings } from '~/lib/i18n/i18n.settings';

import { ReactQueryProvider } from './react-query-provider';

type RootProvidersProps = React.PropsWithChildren<{
  lang?: string;
  theme?: string;
  nonce?: string;
}>;

export function RootProviders({
  lang,
  theme = APP_DEFAULT_THEME,
  nonce,
  children,
}: RootProvidersProps) {
  const i18nSettings = useMemo(() => getI18nSettings(lang), [lang]);

  // Prefer ozer-theme; migrate legacy keel-theme before ThemeProvider mounts.
  migrateThemeStorageKey();

  return (
    <MonitoringProvider>
      <AppEventsProvider>
        <AnalyticsProvider>
          <ReactQueryProvider>
            <I18nProvider settings={i18nSettings} resolver={i18nResolver}>
              <AuthProvider>
                <QuickActionProvider>
                  <ThemeProvider
                    attribute="class"
                    defaultTheme={theme}
                    storageKey={APP_THEME_STORAGE_KEY}
                    enableSystem
                    disableTransitionOnChange
                    enableColorScheme
                    nonce={nonce}
                  >
                    <ThemeColorSync />
                    {children}
                  </ThemeProvider>
                </QuickActionProvider>
              </AuthProvider>

              <If condition={featuresFlagConfig.enableVersionUpdater}>
                <VersionUpdater />
              </If>
            </I18nProvider>
          </ReactQueryProvider>
        </AnalyticsProvider>
      </AppEventsProvider>
    </MonitoringProvider>
  );
}
