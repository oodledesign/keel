import { createI18nSettings } from '@kit/i18n';
import { initializeServerI18n } from '@kit/i18n/server';

export function initializeEmailI18n(params: {
  language: string | undefined;
  namespace: string;
}) {
  const language =
    params.language ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'en';

  return initializeServerI18n(
    createI18nSettings({
      language,
      languages: [language],
      namespaces: params.namespace,
    }),
    async (language, namespace) => {
      try {
        const data = await import(`../locales/${language}/${namespace}.json`);

        return data as Record<string, string>;
      } catch (error) {
        console.log(
          `Error loading i18n file: locales/${language}/${namespace}.json`,
          error,
        );

        return {};
      }
    },
  );
}
