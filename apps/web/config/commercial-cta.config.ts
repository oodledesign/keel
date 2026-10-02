import {
  COMMERCIAL_GRADUATED_PLAN_ID,
  COMMERCIAL_GRADUATED_PRODUCT_ID,
} from '~/lib/billing/commercial-graduated-pricing';

export type CommercialCtaMode = 'waitlist' | 'signup';

export interface CommercialCtaConfig {
  mode: CommercialCtaMode;
  heroBadge: string;
  primaryLabel: string;
  primaryHref: string;
  isExternalOrAuth: boolean;
  reassurance: string;
  faqQuestion: string;
  faqAnswer: string;
}

/**
 * Central CTA mode: 'waitlist' or 'signup'.
 * Default matches the home page: waitlist mode.
 */
const CURRENT_MODE: CommercialCtaMode = ('waitlist' as CommercialCtaMode);

const SIGNUP_URL = `/start?profile=commercial_property&product=${COMMERCIAL_GRADUATED_PRODUCT_ID}&plan=${COMMERCIAL_GRADUATED_PLAN_ID}&seats=1`;

export const commercialCta: CommercialCtaConfig = {
  mode: CURRENT_MODE,
  heroBadge:
    CURRENT_MODE === 'waitlist' ? 'Waiting list open' : '14-day free trial',
  primaryLabel:
    CURRENT_MODE === 'waitlist' ? 'Join the waiting list' : 'Start free',
  primaryHref: CURRENT_MODE === 'waitlist' ? '#waitlist' : SIGNUP_URL,
  isExternalOrAuth: CURRENT_MODE === 'signup',
  reassurance:
    CURRENT_MODE === 'waitlist'
      ? 'We bring agencies on a few desks at a time and reply personally.'
      : '14-day free trial · No payment card required · Set up in minutes',
  faqQuestion:
    CURRENT_MODE === 'waitlist'
      ? 'What happens when I join the waiting list?'
      : 'Is there a free trial?',
  faqAnswer:
    CURRENT_MODE === 'waitlist'
      ? 'We email you personally to set up your desk and import your stock. We onboard agencies a few at a time to ensure everything runs smoothly. If you need immediate access, let us know.'
      : 'Yes. You can test the commercial desk with a 14-day trial. Try portal feeds, matching, pipeline and brochures before paying, with no card required to start.',
};
