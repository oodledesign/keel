import 'server-only';

import { createClient } from '@supabase/supabase-js';

const root =
  process.env.NEXT_PUBLIC_OZER_SITES_ROOT_DOMAIN?.trim() || 'sites.ozer.so';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase env for Ozer Sites renderer');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadPublishedPage(hostname: string, slugPath: string) {
  const host = hostname.toLowerCase();
  const admin = adminClient();
  let siteId: string | null = null;

  const { data: domain } = await admin
    .from('site_domains')
    .select('site_id, verified_at')
    .eq('hostname', host)
    .maybeSingle();

  if (domain?.site_id && domain.verified_at) {
    siteId = String(domain.site_id);
  } else if (host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -(root.length + 1));
    const { data: site } = await admin
      .from('site_sites')
      .select('id, status')
      .eq('subdomain', sub)
      .maybeSingle();
    if (site?.status === 'live') siteId = String(site.id);
  }

  if (!siteId) return null;

  const { data: site } = await admin
    .from('site_sites')
    .select('id, name, theme_tokens, status')
    .eq('id', siteId)
    .maybeSingle();

  if (!site || site.status !== 'live') return null;

  const slug =
    !slugPath || slugPath === '/' || slugPath === 'index'
      ? 'home'
      : slugPath.split('/')[0] || 'home';

  const { data: page } = await admin
    .from('site_pages')
    .select('title, published_data, status')
    .eq('site_id', siteId)
    .eq('slug', slug)
    .maybeSingle();

  if (!page?.published_data) return null;

  return {
    siteName: String(site.name ?? 'Site'),
    title: String(page.title ?? slug),
    themeTokens: (site.theme_tokens ?? {}) as Record<string, unknown>,
    data: page.published_data as Record<string, unknown>,
  };
}
