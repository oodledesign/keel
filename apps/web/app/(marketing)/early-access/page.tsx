import { EarlyAccessLanding } from '~/(marketing)/early-access/_components/early-access-landing';
import { withI18n } from '~/lib/i18n/with-i18n';
import { EARLY_ACCESS_FAQS } from '~/lib/marketing/early-access-content';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, faqPageJsonLd, schemaGraph } from '~/lib/seo/schema';

export const metadata = buildMarketingMetadata({
  title: 'Early access for freelancers & studios — Ozer',
  description:
    'Join Ozer early access at £14/month for 3 months. One workspace for clients, invoices, portals, notes and more — onboarded by hand.',
  path: '/early-access',
  ogType: 'default',
  keywords: [
    'freelancer early access',
    'studio workspace OS',
    'freelance CRM UK',
    'Ozer early access',
  ],
});

function EarlyAccessPage() {
  return (
    <>
      <JsonLd
        data={schemaGraph([
          faqPageJsonLd(
            EARLY_ACCESS_FAQS.map((faq) => ({
              question: faq.question,
              answer: faq.answer,
            })),
          ),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Early access', path: '/early-access' },
          ]),
        ])}
      />
      <EarlyAccessLanding />
    </>
  );
}

export default withI18n(EarlyAccessPage);
