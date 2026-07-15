import { type NextRequest } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { Property } from '~/home/[account]/properties/_lib/server/properties.service';
import { createPropertiesService } from '~/home/[account]/properties/_lib/server/properties.service';

export const runtime = 'nodejs';

function csvEscape(value: string): string {
  // Guard against CSV formula injection when opened in Excel.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pounds(pence: number | null): string {
  return pence != null ? (pence / 100).toFixed(2) : '';
}

function yesNo(value: boolean | null): string {
  return value == null ? '' : value ? 'Yes' : 'No';
}

const HEADERS = [
  'Property name',
  'Full property address',
  'Registered owner',
  'Status',
  'Date of original purchase',
  'Original purchase price (£)',
  'Date of remortgage / further advance',
  'Current O/S mortgage balance (£)',
  'Current estimated valuation (£)',
  'Monthly rent (£)',
  'Monthly mortgage payment (£)',
  'Rental coverage',
  'Interest rate (%)',
  'Name of current lender',
  'Mortgage reference no.',
  'Mortgage start date',
  'Mortgage end / term date',
  'Limited company?',
  'HMO?',
  'Family let?',
  'Currently tenanted?',
  'No. of beds',
  'Bathrooms',
  'Sq ft',
  'Property type',
  'Building type',
  'Property style',
  'Notes',
];

function propertyRow(property: Property): string {
  const rentalCoverage =
    property.monthlyRent != null &&
    property.mortgageMonthlyPayment != null &&
    property.mortgageMonthlyPayment > 0
      ? (property.monthlyRent / property.mortgageMonthlyPayment).toFixed(2)
      : '';

  return [
    csvEscape(property.name),
    csvEscape(property.address ?? ''),
    csvEscape(property.registeredOwner ?? ''),
    property.status,
    property.purchaseDate ?? '',
    pounds(property.purchasePrice),
    property.remortgageDate ?? '',
    pounds(property.mortgageBalance),
    pounds(property.currentValue),
    pounds(property.monthlyRent),
    pounds(property.mortgageMonthlyPayment),
    rentalCoverage,
    property.mortgageInterestRate ?? '',
    csvEscape(property.mortgageLender ?? ''),
    csvEscape(property.mortgageReference ?? ''),
    property.mortgageStartDate ?? '',
    property.mortgageEndDate ?? '',
    yesNo(property.isLimitedCompany),
    yesNo(property.isHmo),
    yesNo(property.isFamilyLet),
    yesNo(property.isTenanted),
    property.bedrooms ?? '',
    property.bathrooms ?? '',
    property.squareFootage ?? '',
    property.propertyType,
    csvEscape(property.buildingType ?? ''),
    csvEscape(property.propertyStyle ?? ''),
    csvEscape(property.notes ?? ''),
  ].join(',');
}

function totalsRow(properties: Property[]): string {
  const sum = (select: (property: Property) => number | null) =>
    properties.reduce((total, property) => total + (select(property) ?? 0), 0);

  const cells = new Array<string>(HEADERS.length).fill('');
  cells[0] = 'Totals';
  cells[5] = pounds(sum((p) => p.purchasePrice));
  cells[7] = pounds(sum((p) => p.mortgageBalance));
  cells[8] = pounds(sum((p) => p.currentValue));
  cells[9] = pounds(sum((p) => p.monthlyRent));
  cells[10] = pounds(sum((p) => p.mortgageMonthlyPayment));
  return cells.join(',');
}

/**
 * Portfolio summary CSV of every property in the workspace (all statuses).
 * RLS on `properties` scopes results to accounts the user is a member of.
 */
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('accountId');

  if (!accountId || !UUID_PATTERN.test(accountId)) {
    return new Response('A valid accountId is required', { status: 400 });
  }

  const client = getSupabaseServerClient() as SupabaseClient;
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return new Response('Sign in required', { status: 401 });
  }

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return new Response('Forbidden', { status: 403 });
  }

  const service = createPropertiesService(client);
  const properties = await service.listAllPropertiesForExport(accountId);

  const lines = [
    HEADERS.join(','),
    ...properties.map(propertyRow),
    '',
    totalsRow(properties),
  ];

  const date = new Date().toISOString().slice(0, 10);

  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="portfolio-summary-${date}.csv"`,
    },
  });
}
