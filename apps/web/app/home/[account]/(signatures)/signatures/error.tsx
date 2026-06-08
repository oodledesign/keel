'use client';

import { useTranslation } from 'react-i18next';

import { Button } from '@kit/ui/button';
import { PageBody, PageHeader } from '@kit/ui/page';

import { SignaturesPostgrestSchemaErrorView } from '../_components/signatures-postgrest-schema-error-view';
import { isSignaturesPostgrestSchemaError } from '../_lib/signatures-postgrest-schema-error';

type SignaturesErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SignaturesError({ error, reset }: SignaturesErrorProps) {
  const { t } = useTranslation('signatures');

  if (isSignaturesPostgrestSchemaError(error)) {
    return <SignaturesPostgrestSchemaErrorView onRetry={reset} />;
  }

  return (
    <>
      <PageHeader
        className="sticky top-0 z-20 border-b border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-4 backdrop-blur-xl lg:px-4"
        displaySidebarTrigger={false}
        title={t('title')}
        description={t('description')}
      />
      <PageBody className="space-y-4 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <p className="text-sm text-destructive">{t('errors.generic')}</p>
        <Button type="button" variant="outline" onClick={reset}>
          {t('errors.postgrestSchemaRetry')}
        </Button>
      </PageBody>
    </>
  );
}
