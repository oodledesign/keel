import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type Property = {
  id: string;
  accountId: string;
  name: string;
  address: string | null;
  propertyType: 'residential' | 'commercial' | 'land' | 'other';
  status: 'active' | 'vacant' | 'maintenance' | 'sold' | 'archived';
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currentValue: number | null;
  registeredOwner: string | null;
  remortgageDate: string | null;
  monthlyRent: number | null;
  isLimitedCompany: boolean | null;
  isHmo: boolean | null;
  isFamilyLet: boolean | null;
  isTenanted: boolean | null;
  buildingType: string | null;
  propertyStyle: string | null;
  astStartDate: string | null;
  astEndDate: string | null;
  mortgageLender: string | null;
  mortgageReference: string | null;
  mortgageBalance: number | null;
  mortgageInterestRate: number | null;
  mortgageMonthlyPayment: number | null;
  mortgageStartDate: string | null;
  mortgageEndDate: string | null;
  mortgageNotes: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PropertyValuation = {
  id: string;
  propertyId: string;
  accountId: string;
  valuedMonth: string;
  valueAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PropertyRow = {
  id: string;
  account_id: string;
  name?: string | null;
  address?: string | null;
  property_type?: string | null;
  status?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_footage?: number | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  current_value?: number | null;
  registered_owner?: string | null;
  remortgage_date?: string | null;
  monthly_rent?: number | null;
  is_limited_company?: boolean | null;
  is_hmo?: boolean | null;
  is_family_let?: boolean | null;
  is_tenanted?: boolean | null;
  building_type?: string | null;
  property_style?: string | null;
  ast_start_date?: string | null;
  ast_end_date?: string | null;
  mortgage_lender?: string | null;
  mortgage_reference?: string | null;
  mortgage_balance?: number | null;
  mortgage_interest_rate?: number | string | null;
  mortgage_monthly_payment?: number | null;
  mortgage_start_date?: string | null;
  mortgage_end_date?: string | null;
  mortgage_notes?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

type ValuationRow = {
  id: string;
  property_id: string;
  account_id: string;
  valued_month: string;
  value_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type PropertyMortgageInput = {
  mortgageLender?: string | null;
  mortgageReference?: string | null;
  mortgageBalance?: number | null;
  mortgageInterestRate?: number | null;
  mortgageMonthlyPayment?: number | null;
  mortgageStartDate?: string | null;
  mortgageEndDate?: string | null;
  mortgageNotes?: string | null;
};

export type PropertyPortfolioInput = {
  registeredOwner?: string | null;
  remortgageDate?: string | null;
  monthlyRent?: number | null;
  isLimitedCompany?: boolean | null;
  isHmo?: boolean | null;
  isFamilyLet?: boolean | null;
  isTenanted?: boolean | null;
  buildingType?: string | null;
  propertyStyle?: string | null;
  astStartDate?: string | null;
  astEndDate?: string | null;
};

export type PropertyWriteInput = PropertyMortgageInput &
  PropertyPortfolioInput & {
    name?: string;
    address?: string | null;
    propertyType?: string;
    status?: string;
    bedrooms?: number | null;
    bathrooms?: number | null;
    squareFootage?: number | null;
    purchaseDate?: string | null;
    purchasePrice?: number | null;
    currentValue?: number | null;
    notes?: string | null;
  };

function mapProperty(row: PropertyRow): Property {
  const rate = row.mortgage_interest_rate;
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name ?? 'Untitled',
    address: row.address ?? null,
    propertyType:
      (row.property_type as Property['propertyType']) ?? 'residential',
    status: (row.status as Property['status']) ?? 'active',
    bedrooms: row.bedrooms ?? null,
    bathrooms: row.bathrooms ?? null,
    squareFootage: row.square_footage ?? null,
    purchaseDate: row.purchase_date ?? null,
    purchasePrice: row.purchase_price ?? null,
    currentValue: row.current_value ?? null,
    registeredOwner: row.registered_owner ?? null,
    remortgageDate: row.remortgage_date ?? null,
    monthlyRent: row.monthly_rent ?? null,
    isLimitedCompany: row.is_limited_company ?? null,
    isHmo: row.is_hmo ?? null,
    isFamilyLet: row.is_family_let ?? null,
    isTenanted: row.is_tenanted ?? null,
    buildingType: row.building_type ?? null,
    propertyStyle: row.property_style ?? null,
    astStartDate: row.ast_start_date ?? null,
    astEndDate: row.ast_end_date ?? null,
    mortgageLender: row.mortgage_lender ?? null,
    mortgageReference: row.mortgage_reference ?? null,
    mortgageBalance: row.mortgage_balance ?? null,
    mortgageInterestRate: rate == null || rate === '' ? null : Number(rate),
    mortgageMonthlyPayment: row.mortgage_monthly_payment ?? null,
    mortgageStartDate: row.mortgage_start_date ?? null,
    mortgageEndDate: row.mortgage_end_date ?? null,
    mortgageNotes: row.mortgage_notes ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapValuation(row: ValuationRow): PropertyValuation {
  return {
    id: row.id,
    propertyId: row.property_id,
    accountId: row.account_id,
    valuedMonth: row.valued_month,
    valueAmount: row.value_amount,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Normalize any date/month string to the first day of that month (YYYY-MM-DD). */
export function toValuedMonth(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }
  const date = new Date(
    trimmed.includes('T') ? trimmed : `${trimmed}T12:00:00`,
  );
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid valuation month');
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function portfolioColumns(input: PropertyPortfolioInput) {
  return {
    ...(input.registeredOwner !== undefined && {
      registered_owner: input.registeredOwner,
    }),
    ...(input.remortgageDate !== undefined && {
      remortgage_date: input.remortgageDate,
    }),
    ...(input.monthlyRent !== undefined && {
      monthly_rent: input.monthlyRent,
    }),
    ...(input.isLimitedCompany !== undefined && {
      is_limited_company: input.isLimitedCompany,
    }),
    ...(input.isHmo !== undefined && { is_hmo: input.isHmo }),
    ...(input.isFamilyLet !== undefined && {
      is_family_let: input.isFamilyLet,
    }),
    ...(input.isTenanted !== undefined && { is_tenanted: input.isTenanted }),
    ...(input.buildingType !== undefined && {
      building_type: input.buildingType,
    }),
    ...(input.propertyStyle !== undefined && {
      property_style: input.propertyStyle,
    }),
    ...(input.astStartDate !== undefined && {
      ast_start_date: input.astStartDate,
    }),
    ...(input.astEndDate !== undefined && {
      ast_end_date: input.astEndDate,
    }),
  };
}

function mortgageColumns(input: PropertyMortgageInput) {
  return {
    ...(input.mortgageLender !== undefined && {
      mortgage_lender: input.mortgageLender,
    }),
    ...(input.mortgageReference !== undefined && {
      mortgage_reference: input.mortgageReference,
    }),
    ...(input.mortgageBalance !== undefined && {
      mortgage_balance: input.mortgageBalance,
    }),
    ...(input.mortgageInterestRate !== undefined && {
      mortgage_interest_rate: input.mortgageInterestRate,
    }),
    ...(input.mortgageMonthlyPayment !== undefined && {
      mortgage_monthly_payment: input.mortgageMonthlyPayment,
    }),
    ...(input.mortgageStartDate !== undefined && {
      mortgage_start_date: input.mortgageStartDate,
    }),
    ...(input.mortgageEndDate !== undefined && {
      mortgage_end_date: input.mortgageEndDate,
    }),
    ...(input.mortgageNotes !== undefined && {
      mortgage_notes: input.mortgageNotes,
    }),
  };
}

export function createPropertiesService(client: SupabaseClient) {
  async function syncCurrentValueFromLatest(propertyId: string) {
    const { data: latest, error } = await client
      .from('property_valuations')
      .select('value_amount')
      .eq('property_id', propertyId)
      .order('valued_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const { error: updateError } = await client
      .from('properties')
      .update({ current_value: latest?.value_amount ?? null })
      .eq('id', propertyId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  async function upsertValuationRecord(input: {
    propertyId: string;
    accountId: string;
    valuedMonth: string;
    valueAmount: number;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<PropertyValuation> {
    const valuedMonth = toValuedMonth(input.valuedMonth);

    const { data, error } = await client
      .from('property_valuations')
      .upsert(
        {
          property_id: input.propertyId,
          account_id: input.accountId,
          valued_month: valuedMonth,
          value_amount: input.valueAmount,
          notes: input.notes ?? null,
          ...(input.createdBy ? { created_by: input.createdBy } : {}),
        },
        { onConflict: 'property_id,valued_month' },
      )
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to save valuation');
    }

    await syncCurrentValueFromLatest(input.propertyId);
    return mapValuation(data as ValuationRow);
  }

  return {
    async listProperties(accountId: string): Promise<Property[]> {
      const { data, error } = await client
        .from('properties')
        .select('*')
        .eq('account_id', accountId)
        .not('status', 'eq', 'archived')
        .order('name');

      if (error) {
        console.error('[properties] listProperties error:', error.message);
        return [];
      }

      return ((data ?? []) as PropertyRow[]).map(mapProperty);
    },

    /** Every property including sold/archived — for portfolio export. */
    async listAllPropertiesForExport(accountId: string): Promise<Property[]> {
      const { data, error } = await client
        .from('properties')
        .select('*')
        .eq('account_id', accountId)
        .order('name');

      if (error) {
        throw new Error(error.message);
      }

      return ((data ?? []) as PropertyRow[]).map(mapProperty);
    },

    async getProperty(propertyId: string): Promise<Property | null> {
      const { data, error } = await client
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .maybeSingle();

      if (error || !data) return null;
      return mapProperty(data as PropertyRow);
    },

    async listValuations(propertyId: string): Promise<PropertyValuation[]> {
      const { data, error } = await client
        .from('property_valuations')
        .select('*')
        .eq('property_id', propertyId)
        .order('valued_month', { ascending: false });

      if (error) {
        console.error('[properties] listValuations error:', error.message);
        return [];
      }

      return ((data ?? []) as ValuationRow[]).map(mapValuation);
    },

    async createProperty(
      input: PropertyWriteInput & { accountId: string; name: string },
    ): Promise<Property> {
      const { count, error: countError } = await client
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', input.accountId)
        .neq('status', 'archived');

      if (countError) {
        throw new Error(countError.message);
      }

      const { assertPropertyCreateAllowed } =
        await import('~/lib/billing/entitlements');
      const gate = await assertPropertyCreateAllowed(
        client,
        input.accountId,
        count ?? 0,
      );
      if (!gate.allowed) {
        throw new Error(gate.reason ?? 'Property limit reached for your plan.');
      }

      const { data, error } = await client
        .from('properties')
        .insert({
          account_id: input.accountId,
          name: input.name,
          address: input.address ?? null,
          property_type: input.propertyType ?? 'residential',
          status: input.status ?? 'active',
          bedrooms: input.bedrooms ?? null,
          bathrooms: input.bathrooms ?? null,
          square_footage: input.squareFootage ?? null,
          purchase_date: input.purchaseDate ?? null,
          purchase_price: input.purchasePrice ?? null,
          current_value: input.currentValue ?? null,
          notes: input.notes ?? null,
          ...portfolioColumns(input),
          ...mortgageColumns(input),
        })
        .select('*')
        .single();

      if (error || !data)
        throw new Error(error?.message ?? 'Failed to create property');

      const property = mapProperty(data as PropertyRow);

      if (input.currentValue != null) {
        const month = input.purchaseDate
          ? toValuedMonth(input.purchaseDate)
          : currentMonthStart();
        await upsertValuationRecord({
          propertyId: property.id,
          accountId: property.accountId,
          valuedMonth: month,
          valueAmount: input.currentValue,
        });
      }

      const refreshed = await client
        .from('properties')
        .select('*')
        .eq('id', property.id)
        .maybeSingle();
      return refreshed.data
        ? mapProperty(refreshed.data as PropertyRow)
        : property;
    },

    async updateProperty(
      propertyId: string,
      input: PropertyWriteInput,
    ): Promise<Property> {
      const { data, error } = await client
        .from('properties')
        .update({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.address !== undefined && { address: input.address }),
          ...(input.propertyType !== undefined && {
            property_type: input.propertyType,
          }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.bedrooms !== undefined && { bedrooms: input.bedrooms }),
          ...(input.bathrooms !== undefined && { bathrooms: input.bathrooms }),
          ...(input.squareFootage !== undefined && {
            square_footage: input.squareFootage,
          }),
          ...(input.purchaseDate !== undefined && {
            purchase_date: input.purchaseDate,
          }),
          ...(input.purchasePrice !== undefined && {
            purchase_price: input.purchasePrice,
          }),
          ...(input.currentValue !== undefined && {
            current_value: input.currentValue,
          }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...portfolioColumns(input),
          ...mortgageColumns(input),
        })
        .eq('id', propertyId)
        .select('*')
        .single();

      if (error || !data)
        throw new Error(error?.message ?? 'Failed to update property');

      const property = mapProperty(data as PropertyRow);

      if (input.currentValue !== undefined) {
        if (input.currentValue != null) {
          await upsertValuationRecord({
            propertyId: property.id,
            accountId: property.accountId,
            valuedMonth: currentMonthStart(),
            valueAmount: input.currentValue,
          });
        } else {
          // Keep current_value aligned with valuation history (source of truth).
          await syncCurrentValueFromLatest(propertyId);
        }

        const refreshed = await client
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .maybeSingle();
        return refreshed.data
          ? mapProperty(refreshed.data as PropertyRow)
          : property;
      }

      return property;
    },

    async upsertValuation(input: {
      propertyId: string;
      accountId: string;
      valuedMonth: string;
      valueAmount: number;
      notes?: string | null;
      createdBy?: string | null;
    }): Promise<PropertyValuation> {
      return upsertValuationRecord(input);
    },

    async deleteValuation(valuationId: string): Promise<void> {
      const { data, error } = await client
        .from('property_valuations')
        .delete()
        .eq('id', valuationId)
        .select('property_id')
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (data?.property_id) {
        await syncCurrentValueFromLatest(data.property_id as string);
      }
    },

    async deleteProperty(propertyId: string): Promise<void> {
      const { error } = await client
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw new Error(error.message);
    },
  };
}
