/**
 * Stripe Price IDs — set in environment after creating products in Stripe Dashboard (GBP).
 * Placeholder values allow local dev/build; checkout requires real price IDs.
 */
function price(envKey: string, fallback: string): string {
  const value = process.env[envKey]?.trim();
  return value && value.length > 0 ? value : fallback;
}

export const OZER_STRIPE_PRICES = {
  community_monthly: price(
    'STRIPE_PRICE_COMMUNITY_MONTHLY',
    'price_ozer_community_monthly',
  ),
  community_yearly: price(
    'STRIPE_PRICE_COMMUNITY_YEARLY',
    'price_ozer_community_yearly',
  ),
  business_lite_monthly: price(
    'STRIPE_PRICE_BUSINESS_LITE_MONTHLY',
    'price_ozer_business_lite_monthly',
  ),
  /**
   * Starter graduated per-seat Price (seat 1 £14, seats 2+ £9).
   * Create in Stripe Dashboard (test mode) then set the env var.
   */
  business_starter_monthly: price(
    'STRIPE_PRICE_BUSINESS_STARTER_MONTHLY',
    'price_ozer_business_starter_monthly',
  ),
  /** Graduated per-seat Price (seat 1 £29, seats 2+ £22). Live id may still be the three-band Price until Step 0. */
  business_monthly: price(
    'STRIPE_PRICE_BUSINESS_MONTHLY',
    'price_ozer_business_monthly',
  ),
  /**
   * Pro corrected Price (seat 1 £29, seats 2+ £22) — replace BUSINESS_MONTHLY
   * only after confirming zero active/trialing Pro subscribers.
   * Placeholder until Step 0 verification + dashboard creation.
   */
  business_monthly_v2: price(
    'STRIPE_PRICE_BUSINESS_MONTHLY_V2',
    'price_ozer_business_monthly_v2',
  ),
  business_yearly: price(
    'STRIPE_PRICE_BUSINESS_YEARLY',
    'price_ozer_business_yearly',
  ),
  /** Yearly Pro corrected Price (10× monthly v2 bands) — same gate as monthly v2. */
  business_yearly_v2: price(
    'STRIPE_PRICE_BUSINESS_YEARLY_V2',
    'price_ozer_business_yearly_v2',
  ),
  property_starter_monthly: price(
    'STRIPE_PRICE_PROPERTY_STARTER_MONTHLY',
    'price_ozer_property_starter_monthly',
  ),
  property_starter_yearly: price(
    'STRIPE_PRICE_PROPERTY_STARTER_YEARLY',
    'price_ozer_property_starter_yearly',
  ),
  property_portfolio_monthly: price(
    'STRIPE_PRICE_PROPERTY_PORTFOLIO_MONTHLY',
    'price_ozer_property_portfolio_monthly',
  ),
  property_portfolio_yearly: price(
    'STRIPE_PRICE_PROPERTY_PORTFOLIO_YEARLY',
    'price_ozer_property_portfolio_yearly',
  ),
  /** Graduated per-seat Price (seat 1 £89, 2–7 £55, 8+ £39). */
  commercial_property_monthly: price(
    'STRIPE_PRICE_COMMERCIAL_PROPERTY_MONTHLY',
    'price_ozer_commercial_property_monthly',
  ),
  addon_portal_publishing_monthly: price(
    'STRIPE_PRICE_ADDON_PORTAL_PUBLISHING_MONTHLY',
    'price_ozer_addon_portal_publishing_monthly',
  ),
  addon_signatures_starter_monthly: price(
    'STRIPE_PRICE_ADDON_SIGNATURES_STARTER_MONTHLY',
    'price_ozer_addon_signatures_starter_monthly',
  ),
  addon_signatures_starter_yearly: price(
    'STRIPE_PRICE_ADDON_SIGNATURES_STARTER_YEARLY',
    'price_ozer_addon_signatures_starter_yearly',
  ),
  addon_signatures_team_monthly: price(
    'STRIPE_PRICE_ADDON_SIGNATURES_TEAM_MONTHLY',
    'price_ozer_addon_signatures_team_monthly',
  ),
  addon_signatures_team_yearly: price(
    'STRIPE_PRICE_ADDON_SIGNATURES_TEAM_YEARLY',
    'price_ozer_addon_signatures_team_yearly',
  ),
  addon_signatures_office_monthly: price(
    'STRIPE_PRICE_ADDON_SIGNATURES_OFFICE_MONTHLY',
    'price_ozer_addon_signatures_office_monthly',
  ),
  addon_signatures_office_yearly: price(
    'STRIPE_PRICE_ADDON_SIGNATURES_OFFICE_YEARLY',
    'price_ozer_addon_signatures_office_yearly',
  ),
  addon_rankly_monthly: price(
    'STRIPE_PRICE_ADDON_RANKLY_MONTHLY',
    'price_ozer_addon_rankly_monthly',
  ),
  addon_feedflow_monthly: price(
    'STRIPE_PRICE_ADDON_FEEDFLOW_MONTHLY',
    'price_ozer_addon_feedflow_monthly',
  ),
  addon_videos_starter_monthly: price(
    'STRIPE_PRICE_ADDON_VIDEOS_STARTER_MONTHLY',
    'price_ozer_addon_videos_starter_monthly',
  ),
  addon_videos_growth_monthly: price(
    'STRIPE_PRICE_ADDON_VIDEOS_GROWTH_MONTHLY',
    'price_ozer_addon_videos_growth_monthly',
  ),
  addon_videos_pro_monthly: price(
    'STRIPE_PRICE_ADDON_VIDEOS_PRO_MONTHLY',
    'price_ozer_addon_videos_pro_monthly',
  ),
  addon_videos_studio_monthly: price(
    'STRIPE_PRICE_ADDON_VIDEOS_STUDIO_MONTHLY',
    'price_ozer_addon_videos_studio_monthly',
  ),
  addon_email_assistant_monthly: price(
    'STRIPE_PRICE_ADDON_EMAIL_ASSISTANT_MONTHLY',
    'price_ozer_addon_email_assistant_monthly',
  ),
  addon_site_studio_monthly: price(
    'STRIPE_PRICE_ADDON_SITE_STUDIO_MONTHLY',
    'price_ozer_addon_site_studio_monthly',
  ),
  addon_site_studio_yearly: price(
    'STRIPE_PRICE_ADDON_SITE_STUDIO_YEARLY',
    'price_ozer_addon_site_studio_yearly',
  ),
  ai_credits_boost: price(
    'STRIPE_PRICE_AI_CREDITS_BOOST',
    'price_ozer_ai_credits_boost',
  ),
  ai_credits_studio: price(
    'STRIPE_PRICE_AI_CREDITS_STUDIO',
    'price_ozer_ai_credits_studio',
  ),
  ai_credits_agency: price(
    'STRIPE_PRICE_AI_CREDITS_AGENCY',
    'price_ozer_ai_credits_agency',
  ),
  ai_credits_boost_monthly: price(
    'STRIPE_PRICE_AI_CREDITS_BOOST_MONTHLY',
    'price_ozer_ai_credits_boost_monthly',
  ),
  ai_credits_studio_monthly: price(
    'STRIPE_PRICE_AI_CREDITS_STUDIO_MONTHLY',
    'price_ozer_ai_credits_studio_monthly',
  ),
  ai_credits_agency_monthly: price(
    'STRIPE_PRICE_AI_CREDITS_AGENCY_MONTHLY',
    'price_ozer_ai_credits_agency_monthly',
  ),
  media_starter_monthly: price(
    'STRIPE_PRICE_MEDIA_STARTER_MONTHLY',
    'price_ozer_media_starter_monthly',
  ),
  media_studio_monthly: price(
    'STRIPE_PRICE_MEDIA_STUDIO_MONTHLY',
    'price_ozer_media_studio_monthly',
  ),
  media_agency_monthly: price(
    'STRIPE_PRICE_MEDIA_AGENCY_MONTHLY',
    'price_ozer_media_agency_monthly',
  ),
  media_topup_small: price(
    'STRIPE_PRICE_MEDIA_TOPUP_SMALL',
    'price_ozer_media_topup_small',
  ),
  media_topup_large: price(
    'STRIPE_PRICE_MEDIA_TOPUP_LARGE',
    'price_ozer_media_topup_large',
  ),
  /** Campaigns add-on — placeholders until live Stripe prices exist. */
  addon_campaigns_starter_monthly: price(
    'STRIPE_PRICE_ADDON_CAMPAIGNS_STARTER_MONTHLY',
    'price_ozer_addon_campaigns_starter_monthly',
  ),
  addon_campaigns_growth_monthly: price(
    'STRIPE_PRICE_ADDON_CAMPAIGNS_GROWTH_MONTHLY',
    'price_ozer_addon_campaigns_growth_monthly',
  ),
  addon_campaigns_pro_monthly: price(
    'STRIPE_PRICE_ADDON_CAMPAIGNS_PRO_MONTHLY',
    'price_ozer_addon_campaigns_pro_monthly',
  ),
} as const;

export const OZER_BILLING_CURRENCY =
  process.env.STRIPE_BILLING_CURRENCY?.trim().toUpperCase() || 'GBP';
