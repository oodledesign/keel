import { cookies, headers } from 'next/headers';

import { Toaster } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { RootProviders } from '~/components/root-providers';
import { TextSizeSync } from '~/components/text-size-sync';
import { getFontsClassName } from '~/lib/fonts';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { generateRootMetadata } from '~/lib/root-metadata';
import { getRootTheme } from '~/lib/root-theme';

import '../styles/globals.css';

export const generateMetadata = () => generateRootMetadata();

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, nonce, i18n] = await Promise.all([
    getRootTheme(),
    getCspNonce(),
    createI18nServerInstance(),
  ]);

  // Text size is applied on the client (TextSizeSync) to avoid hydration mismatch
  const className = getRootClassName(theme, 'text-size-standard');
  const language = i18n.language;

  return (
    <html lang={language} className={className} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <TextSizeSync />
        <RootProviders theme={theme} lang={language} nonce={nonce}>
          {children}
        </RootProviders>

        <Toaster richColors={true} theme={theme} position="top-center" />
      </body>
    </html>
  );
}

function getRootClassName(theme: string, textSizeClass: string) {
  const fontsClassName = getFontsClassName(theme);

  return cn(
    'bg-background min-h-screen antialiased md:overscroll-y-none',
    fontsClassName,
    textSizeClass,
  );
}

async function getCspNonce() {
  const headersStore = await headers();

  return headersStore.get('x-nonce') ?? undefined;
}
