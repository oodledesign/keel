/**
 * Stripe Price IDs — set in environment after creating products in Stripe Dashboard (GBP).
 * Placeholder values allow local dev/build; checkout requires real price IDs.
 */
function price(envKey: string, fallback: string): string {
  const value = process.env[envKey]?.trim();
  return value && value.length > 0 ? value : fallback;
}

export const KEEL_STRIPE_PRICES = {
  community_monthly: price(
    'STRIPE_PRICE_COMMUNITY_MONTHLY',
    'price_keel_community_monthly',
  ),
  community_yearly: price(
    'STRIPE_PRICE_COMMUNITY_YEARLY',
    'price_keel_community_yearly',
  ),
  business_lite_monthly: price(
    'STRIPE_PRICE_BUSINESS_LITE_MONTHLY',
    'price_keel_business_lite_monthly',
  ),
  business_solo_monthly: price(
    'STRIPE_PRICE_BUSINESS_SOLO_MONTHLY',
    'price_keel_business_solo_monthly',
  ),
  business_solo_yearly: price(
    'STRIPE_PRICE_BUSINESS_SOLO_YEARLY',
    'price_keel_business_solo_yearly',
  ),
  business_team_monthly: price(
    'STRIPE_PRICE_BUSINESS_TEAM_MONTHLY',
    'price_keel_business_team_monthly',
  ),
  business_team_yearly: price(
    'STRIPE_PRICE_BUSINESS_TEAM_YEARLY',
    'price_keel_business_team_yearly',
  ),
  business_scale_monthly: price(
    'STRIPE_PRICE_BUSINESS_SCALE_MONTHLY',
    'price_keel_business_scale_monthly',
  ),
  business_scale_yearly: price(
    'STRIPE_PRICE_BUSINESS_SCALE_YEARLY',
    'price_keel_business_scale_yearly',
  ),
  property_starter_monthly: price(
    'STRIPE_PRICE_PROPERTY_STARTER_MONTHLY',
    'price_keel_property_starter_monthly',
  ),
  property_starter_yearly: price(
    'STRIPE_PRICE_PROPERTY_STARTER_YEARLY',
    'price_keel_property_starter_yearly',
  ),
  property_portfolio_monthly: price(
    'STRIPE_PRICE_PROPERTY_PORTFOLIO_MONTHLY',
    'price_keel_property_portfolio_monthly',
  ),
  property_portfolio_yearly: price(
    'STRIPE_PRICE_PROPERTY_PORTFOLIO_YEARLY',
    'price_keel_property_portfolio_yearly',
  ),
  addon_signatures_monthly: price(
    'STRIPE_PRICE_ADDON_SIGNATURES_MONTHLY',
    'price_keel_addon_signatures_monthly',
  ),
  addon_rankly_monthly: price(
    'STRIPE_PRICE_ADDON_RANKLY_MONTHLY',
    'price_keel_addon_rankly_monthly',
  ),
  addon_feedflow_monthly: price(
    'STRIPE_PRICE_ADDON_FEEDFLOW_MONTHLY',
    'price_keel_addon_feedflow_monthly',
  ),
  addon_videos_starter_monthly: price(
    'STRIPE_PRICE_ADDON_VIDEOS_STARTER_MONTHLY',
    'price_keel_addon_videos_starter_monthly',
  ),
  addon_videos_growth_monthly: price(
    'STRIPE_PRICE_ADDON_VIDEOS_GROWTH_MONTHLY',
    'price_keel_addon_videos_growth_monthly',
  ),
  addon_videos_pro_monthly: price(
    'STRIPE_PRICE_ADDON_VIDEOS_PRO_MONTHLY',
    'price_keel_addon_videos_pro_monthly',
  ),
  addon_videos_studio_monthly: price(
    'STRIPE_PRICE_ADDON_VIDEOS_STUDIO_MONTHLY',
    'price_keel_addon_videos_studio_monthly',
  ),
  addon_email_assistant_monthly: price(
    'STRIPE_PRICE_ADDON_EMAIL_ASSISTANT_MONTHLY',
    'price_keel_addon_email_assistant_monthly',
  ),
} as const;

export const KEEL_BILLING_CURRENCY =
  process.env.STRIPE_BILLING_CURRENCY?.trim().toUpperCase() || 'GBP';
