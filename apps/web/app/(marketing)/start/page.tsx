import { withI18n } from '~/lib/i18n/with-i18n';
import { marketingShellClass } from '~/lib/marketing/marketing-ui';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { cn } from '@kit/ui/utils';

import { StartFlowClient } from './_components/start-flow-client';

export const metadata = buildMarketingMetadata({
  title: 'Start free — Ozer',
  description:
    'Create a free Ozer personal account first. Optionally add a business, family, or community workspace — Solo and Team include a 14-day trial.',
  path: '/start',
  keywords: [
    'Ozer signup',
    'start free',
    'freelance workspace',
    'personal account',
  ],
});

function StartPage() {
  return (
    <main className={cn('relative overflow-hidden', marketingShellClass)}>
      <div className="mx-auto w-full max-w-7xl px-6 pb-20 pt-16 md:pt-20">
        <StartFlowClient />
      </div>
    </main>
  );
}

export default withI18n(StartPage);
