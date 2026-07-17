import { createI18nServerInstance } from '~/lib/i18n/i18n.server';

import { SignaturesPostgrestSchemaMissingCard } from './signatures-postgrest-schema-missing-card';

export async function SignaturesPostgrestSchemaMissing() {
  const i18n = await createI18nServerInstance();
  const t = i18n.getFixedT(null, 'signatures');

  const steps = [
    t('errors.postgrestSchemaStep1'),
    t('errors.postgrestSchemaStep2'),
    t('errors.postgrestSchemaStep3'),
  ] as const;

  return (
    <SignaturesPostgrestSchemaMissingCard
      title={t('errors.postgrestSchemaTitle')}
      description={t('errors.postgrestSchemaDescription')}
      steps={steps}
    />
  );
}
