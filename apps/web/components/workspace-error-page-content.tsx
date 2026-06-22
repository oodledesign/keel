'use client';

import Link from 'next/link';

import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { ArrowLeft } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';

export function WorkspaceErrorPageContent({
  reset,
  backLink = pathsConfig.app.home,
}: {
  reset?: () => void;
  backLink?: string;
}) {
  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-white lg:px-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <Alert
          variant="destructive"
          className="border-white/10 bg-[var(--workspace-shell-panel)] text-white [&>svg]:text-red-400"
        >
          <ExclamationTriangleIcon className="h-4 w-4" />

          <AlertTitle>
            <Trans i18nKey="common:genericError" />
          </AlertTitle>

          <AlertDescription className="text-zinc-300">
            <Trans i18nKey="common:genericErrorSubHeading" />
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-3">
          {reset ? (
            <Button variant="outline" onClick={reset}>
              <ArrowLeft className="h-4 w-4" />
              <Trans i18nKey="common:retry" />
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={backLink}>
                <ArrowLeft className="h-4 w-4" />
                <Trans i18nKey="common:backToHomePage" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </PageBody>
  );
}
