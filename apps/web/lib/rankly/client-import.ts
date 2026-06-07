import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'GB',
  gb: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  au: 'AU',
  australia: 'AU',
  ca: 'CA',
  canada: 'CA',
  ie: 'IE',
  ireland: 'IE',
  nz: 'NZ',
  'new zealand': 'NZ',
};

export function countryToTargetCountry(country: string | null | undefined): string {
  if (!country?.trim()) return 'GB';
  const trimmed = country.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return COUNTRY_ALIASES[trimmed.toLowerCase()] ?? 'GB';
}

export function clientDisplayName(client: {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return (
    client.display_name?.trim() ||
    client.company_name?.trim() ||
    [client.first_name, client.last_name].filter(Boolean).join(' ').trim() ||
    'Unnamed client'
  );
}

export function normaliseDomain(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '').replace(/^www\./, '');
  value = value.split('/')[0] ?? value;
  return value || null;
}

type ClientRow = {
  id: string;
  client_org_id: string | null;
  display_name: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
};

type WebsiteRow = {
  domain: string | null;
  client_org_id: string | null;
};

export type RanklyClientImportOption = {
  clientId: string;
  label: string;
  suggestedName: string;
  domain: string | null;
  targetCountry: string;
  targetLanguage: string;
  hasExistingProject: boolean;
};

export async function buildRanklyClientImportOptions(
  client: SupabaseClient,
  accountId: string,
): Promise<RanklyClientImportOption[]> {
  const { data: clients, error: clientsError } = await client
    .from('clients')
    .select(
      'id, client_org_id, display_name, company_name, first_name, last_name, country',
    )
    .eq('account_id', accountId)
    .order('display_name', { ascending: true })
    .limit(500);

  if (clientsError || !clients?.length) {
    return [];
  }

  const { data: websites } = await client
    .from('websites')
    .select('domain, client_org_id')
    .eq('business_id', accountId)
    .not('domain', 'is', null);

  const { data: linkedProjects } = await supabaseCustomSchema(client, 'rankly')
    .from('projects')
    .select('client_id')
    .eq('account_id', accountId)
    .not('client_id', 'is', null);

  const linkedClientIds = new Set(
    (linkedProjects ?? [])
      .map((row: { client_id: string | null }) => row.client_id)
      .filter(Boolean),
  );

  const domainByOrgId = new Map<string, string>();
  for (const website of (websites ?? []) as WebsiteRow[]) {
    if (!website.client_org_id) continue;
    const domain = normaliseDomain(website.domain);
    if (domain && !domainByOrgId.has(website.client_org_id)) {
      domainByOrgId.set(website.client_org_id, domain);
    }
  }

  return (clients as ClientRow[]).map((row) => {
    const suggestedName = clientDisplayName(row);
    const domain = row.client_org_id
      ? (domainByOrgId.get(row.client_org_id) ?? null)
      : null;

    return {
      clientId: row.id,
      label: suggestedName,
      suggestedName,
      domain,
      targetCountry: countryToTargetCountry(row.country),
      targetLanguage: 'en',
      hasExistingProject: linkedClientIds.has(row.id),
    };
  });
}

export async function buildRanklyImportSeedForClient(
  client: SupabaseClient,
  accountId: string,
  clientId: string,
): Promise<RanklyClientImportOption | null> {
  const options = await buildRanklyClientImportOptions(client, accountId);
  return options.find((option) => option.clientId === clientId) ?? null;
}
