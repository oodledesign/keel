import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type AgencyBranding = {
  id: string;
  business_id: string;
  brand_name: string | null;
  custom_domain: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_colour: string | null;
  support_email: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
};

export const getAgencyBrandingBySlug = cache(
  async (slug: string): Promise<AgencyBranding | null> => {
    const normalized = slug.trim().toLowerCase();

    if (!normalized) {
      return null;
    }

    const client = getSupabaseServerAdminClient();

    const { data, error } = await client
      .from('agency_branding')
      .select(
        'id, business_id, brand_name, custom_domain, logo_url, favicon_url, primary_colour, support_email, slug, created_at, updated_at',
      )
      .eq('slug', normalized)
      .maybeSingle();

    if (error) {
      console.error('[agency-branding] lookup failed:', error.message);
      return null;
    }

    if (!data) {
      return null;
    }

    return data as AgencyBranding;
  },
);
