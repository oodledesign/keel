'use client';

import { useTranslation } from 'react-i18next';

import { PageBody, PageHeader } from '@kit/ui/page';

import {
  SignaturesPostgrestSchemaMissingCard,
  SignaturesPostgrestSchemaRetryButton,
} from './signatures-postgrest-schema-missing-card';

type SignaturesPostgrestSchemaErrorViewProps = {
  onRetry: () => void;
};

export function SignaturesPostgrestSchemaErrorView({
  onRetry,
}: SignaturesPostgrestSchemaErrorViewProps) {
  const { t } = useTranslation('signatures');

  const steps = [
    t('errors.postgrestSchemaStep1'),
    t('errors.postgrestSchemaStep2'),
    t('errors.postgrestSchemaStep3'),
  ] as const;

  return (
    <>
      <PageHeader
        className="sticky top-0 z-20 border-b border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-4 backdrop-blur-xl lg:px-4"
        displaySidebarTrigger={false}
        title={t('title')}
        description={t('description')}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <SignaturesPostgrestSchemaMissingCard
          title={t('errors.postgrestSchemaTitle')}
          description={t('errors.postgrestSchemaDescription')}
          steps={steps}
          footer={
            <SignaturesPostgrestSchemaRetryButton
              label={t('errors.postgrestSchemaRetry')}
              onRetry={onRetry}
            />
          }
        />
      </PageBody>
    </>
  );
}
