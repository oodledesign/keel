import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';
import featureFlagsConfig from '~/config/feature-flags.config';

export function SignaturesModuleDisabled({
  accountSlug,
}: {
  accountSlug: string;
}) {
  const settingsPath = pathsConfig.app.accountSettings.replace(
    '[account]',
    accountSlug,
  );
  const billingPath = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center py-12">
      <Card className="max-w-lg border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader>
          <CardTitle className="text-xl">
            <Trans i18nKey="signatures:module.disabled.title" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            <Trans i18nKey="signatures:module.disabled.description" />
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="default">
              <Link href={settingsPath}>
                <Trans i18nKey="signatures:module.disabled.linkSettings" />
              </Link>
            </Button>
            {featureFlagsConfig.enableTeamAccountBilling ? (
              <Button asChild variant="outline">
                <Link href={billingPath}>
                  <Trans i18nKey="signatures:module.disabled.linkBilling" />
                </Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
