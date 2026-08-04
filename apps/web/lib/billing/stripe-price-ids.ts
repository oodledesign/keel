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
  business_solo_monthly: price(
    'STRIPE_PRICE_BUSINESS_SOLO_MONTHLY',
    'price_ozer_business_solo_monthly',
  ),
  business_solo_yearly: price(
    'STRIPE_PRICE_BUSINESS_SOLO_YEARLY',
    'price_ozer_business_solo_yearly',
  ),
  business_team_monthly: price(
    'STRIPE_PRICE_BUSINESS_TEAM_MONTHLY',
    'price_ozer_business_team_monthly',
  ),
  business_team_yearly: price(
    'STRIPE_PRICE_BUSINESS_TEAM_YEARLY',
    'price_ozer_business_team_yearly',
  ),
  business_scale_monthly: price(
    'STRIPE_PRICE_BUSINESS_SCALE_MONTHLY',
    'price_ozer_business_scale_monthly',
  ),
  business_scale_yearly: price(
    'STRIPE_PRICE_BUSINESS_SCALE_YEARLY',
    'price_ozer_business_scale_yearly',
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
  commercial_property_solo_monthly: price(
    'STRIPE_PRICE_COMMERCIAL_PROPERTY_SOLO_MONTHLY',
    'price_ozer_commercial_property_solo_monthly',
  ),
  commercial_property_team_monthly: price(
    'STRIPE_PRICE_COMMERCIAL_PROPERTY_TEAM_MONTHLY',
    'price_ozer_commercial_property_team_monthly',
  ),
  commercial_property_office_monthly: price(
    'STRIPE_PRICE_COMMERCIAL_PROPERTY_OFFICE_MONTHLY',
    'price_ozer_commercial_property_office_monthly',
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
} as const;

export const OZER_BILLING_CURRENCY =
  process.env.STRIPE_BILLING_CURRENCY?.trim().toUpperCase() || 'GBP';
