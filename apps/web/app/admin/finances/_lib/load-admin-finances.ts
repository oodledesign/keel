import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';

export type OperatingCostCategory =
  | 'vercel'
  | 'supabase'
  | 'domain'
  | 'email'
  | 'monitoring'
  | 'ai_provider'
  | 'other';

export type PlatformOperatingCost = {
  id: string;
  category: OperatingCostCategory;
  label: string;
  amountMinor: number;
  currency: string;
  periodMonth: string;
  notes: string | null;
};

export type AiModelCostRate = {
  model: string;
  provider: string;
  inputUsdPerMtok: number;
  outputUsdPerMtok: number;
  notes: string | null;
};

export type AiAccountCostRow = {
  accountId: string;
  accountName: string;
  accountSlug: string;
  creditsUsed: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export type AdminFinancesData = {
  periodStart: string;
  periodEnd: string;
  periodMonth: string;
  estimatedMrrMinor: number;
  mrrCurrency: string;
  activePayingWorkspaces: number;
  aiPackRevenueMinor: number;
  aiPackRevenueCurrency: string;
  aiCreditsUsed: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  aiEstimatedCostUsd: number;
  aiByFeature: Array<{ feature: string; credits: number; costUsd: number }>;
  aiByModel: Array<{ model: string; credits: number; costUsd: number }>;
  topAiAccounts: AiAccountCostRow[];
  operatingCosts: PlatformOperatingCost[];
  operatingCostsTotalMinor: number;
  operatingCostsCurrency: string;
  modelRates: AiModelCostRate[];
  /** GBP OpEx ÷ paying workspaces (AI USD kept separate). */
  opexPerPayingWorkspaceMinor: number | null;
  /** AI USD estimate ÷ paying workspaces. */
  aiCostPerPayingWorkspaceUsd: number | null;
};

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parsePeriodMonth(input: string | undefined): Date {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, 1));
  }
  return startOfMonth(new Date());
}

function estimateTxnCostUsd(
  row: {
    model_used: string;
    input_tokens: number | null;
    output_tokens: number | null;
    credits_used: number;
  },
  rates: Map<string, AiModelCostRate>,
): number {
  const rate =
    rates.get(row.model_used) ??
    [...rates.values()].find((r) => row.model_used.includes(r.model)) ??
    null;

  const input = Number(row.input_tokens ?? 0);
  const output = Number(row.output_tokens ?? 0);

  if (rate && (input > 0 || output > 0)) {
    return (
      (input / 1_000_000) * rate.inputUsdPerMtok +
      (output / 1_000_000) * rate.outputUsdPerMtok
    );
  }

  // Fallback: assume ~1 credit ≈ $0.002 when tokens are missing.
  return Math.max(0, Number(row.credits_used ?? 0)) * 0.002;
}

export const loadAdminFinances = cache(
  async (periodMonthParam?: string): Promise<AdminFinancesData> => {
    await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient();
    // New finance tables may precede generated Database types.
    const adminUntyped = admin as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          order: (col: string) => Promise<{
            data: Record<string, unknown>[] | null;
            error: { message: string } | null;
          }>;
          eq: (col: string, value: string) => {
            order: (col: string) => Promise<{
              data: Record<string, unknown>[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };

    const periodStart = parsePeriodMonth(periodMonthParam);
    const periodEnd = addMonths(periodStart, 1);
    const periodStartIso = periodStart.toISOString();
    const periodEndIso = periodEnd.toISOString();
    const periodMonth = toIsoDate(periodStart);

    const [
      ratesRes,
      costsRes,
      txnsRes,
      purchasesRes,
      activeSubsRes,
    ] = await Promise.all([
      adminUntyped
        .from('ai_model_cost_rates')
        .select('model, provider, input_usd_per_mtok, output_usd_per_mtok, notes')
        .order('model'),
      adminUntyped
        .from('platform_operating_costs')
        .select(
          'id, category, label, amount_minor, currency, period_month, notes',
        )
        .eq('period_month', periodMonth)
        .order('category'),
      admin
        .from('ai_credit_transactions')
        .select(
          'account_id, feature, model_used, credits_used, input_tokens, output_tokens',
        )
        .gte('created_at', periodStartIso)
        .lt('created_at', periodEndIso)
        .limit(50_000),
      admin
        .from('ai_credit_purchases')
        .select('amount_total, currency')
        .gte('created_at', periodStartIso)
        .lt('created_at', periodEndIso),
      admin
        .from('subscriptions')
        .select('id, currency')
        .in('status', ['active', 'trialing']),
    ]);

    if (ratesRes.error) throw new Error(ratesRes.error.message);
    if (costsRes.error) throw new Error(costsRes.error.message);
    if (txnsRes.error) throw new Error(txnsRes.error.message);
    if (purchasesRes.error) throw new Error(purchasesRes.error.message);
    if (activeSubsRes.error) throw new Error(activeSubsRes.error.message);

    const modelRates: AiModelCostRate[] = (ratesRes.data ?? []).map((row) => ({
      model: String(row.model),
      provider: String(row.provider),
      inputUsdPerMtok: Number(row.input_usd_per_mtok),
      outputUsdPerMtok: Number(row.output_usd_per_mtok),
      notes: (row.notes as string | null) ?? null,
    }));
    const ratesMap = new Map(modelRates.map((r) => [r.model, r]));

    const operatingCosts: PlatformOperatingCost[] = (costsRes.data ?? []).map(
      (row) => ({
        id: String(row.id),
        category: row.category as OperatingCostCategory,
        label: String(row.label),
        amountMinor: Number(row.amount_minor),
        currency: String(row.currency ?? 'gbp'),
        periodMonth: String(row.period_month),
        notes: (row.notes as string | null) ?? null,
      }),
    );

    const operatingCostsTotalMinor = operatingCosts.reduce(
      (sum, row) => sum + row.amountMinor,
      0,
    );
    const operatingCostsCurrency = operatingCosts[0]?.currency ?? 'gbp';

    let aiPackRevenueMinor = 0;
    let aiPackRevenueCurrency = 'gbp';
    for (const row of purchasesRes.data ?? []) {
      aiPackRevenueMinor += Number(row.amount_total ?? 0);
      if (row.currency) aiPackRevenueCurrency = String(row.currency);
    }

    const activeSubIds = (activeSubsRes.data ?? []).map((s) => String(s.id));
    const currencyBySub = new Map(
      (activeSubsRes.data ?? []).map((s) => [
        String(s.id),
        String(s.currency ?? 'gbp'),
      ]),
    );

    let estimatedMrrMinor = 0;
    let mrrCurrency = 'gbp';
    if (activeSubIds.length > 0) {
      const itemsRes = await admin
        .from('subscription_items')
        .select(
          'price_amount, quantity, interval, interval_count, subscription_id',
        )
        .in('subscription_id', activeSubIds);

      if (itemsRes.error) throw new Error(itemsRes.error.message);

      for (const item of itemsRes.data ?? []) {
        const subscriptionId = String(item.subscription_id);
        mrrCurrency = currencyBySub.get(subscriptionId) ?? mrrCurrency;
        const priceAmount = Number(item.price_amount ?? 0);
        const quantity = Number(item.quantity ?? 1);
        const interval = String(item.interval);
        const intervalCount = Number(item.interval_count ?? 1);
        let monthly = priceAmount * quantity;
        if (interval === 'year') {
          monthly = monthly / (12 * Math.max(intervalCount, 1));
        } else if (interval === 'week') {
          monthly = (monthly * 52) / 12;
        } else if (interval === 'day') {
          monthly = (monthly * 365) / 12;
        } else if (intervalCount > 1) {
          monthly = monthly / intervalCount;
        }
        estimatedMrrMinor += monthly;
      }
    }

    const activePayingWorkspaces = activeSubIds.length;

    let aiCreditsUsed = 0;
    let aiInputTokens = 0;
    let aiOutputTokens = 0;
    let aiEstimatedCostUsd = 0;

    const byFeature = new Map<string, { credits: number; costUsd: number }>();
    const byModel = new Map<string, { credits: number; costUsd: number }>();
    const byAccount = new Map<
      string,
      {
        credits: number;
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
      }
    >();

    for (const row of txnsRes.data ?? []) {
      const credits = Number(row.credits_used ?? 0);
      const input = Number(row.input_tokens ?? 0);
      const output = Number(row.output_tokens ?? 0);
      const cost = estimateTxnCostUsd(
        {
          model_used: String(row.model_used),
          input_tokens: row.input_tokens as number | null,
          output_tokens: row.output_tokens as number | null,
          credits_used: credits,
        },
        ratesMap,
      );

      aiCreditsUsed += credits;
      aiInputTokens += input;
      aiOutputTokens += output;
      aiEstimatedCostUsd += cost;

      const feature = String(row.feature);
      const featureAgg = byFeature.get(feature) ?? { credits: 0, costUsd: 0 };
      featureAgg.credits += credits;
      featureAgg.costUsd += cost;
      byFeature.set(feature, featureAgg);

      const model = String(row.model_used);
      const modelAgg = byModel.get(model) ?? { credits: 0, costUsd: 0 };
      modelAgg.credits += credits;
      modelAgg.costUsd += cost;
      byModel.set(model, modelAgg);

      const accountId = String(row.account_id);
      const accountAgg = byAccount.get(accountId) ?? {
        credits: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      };
      accountAgg.credits += credits;
      accountAgg.inputTokens += input;
      accountAgg.outputTokens += output;
      accountAgg.costUsd += cost;
      byAccount.set(accountId, accountAgg);
    }

    const topAccountIds = [...byAccount.entries()]
      .sort((a, b) => b[1].costUsd - a[1].costUsd)
      .slice(0, 15)
      .map(([id]) => id);

    const accountsById = new Map<string, { name: string; slug: string }>();
    if (topAccountIds.length > 0) {
      const accountsRes = await admin
        .from('accounts')
        .select('id, name, slug')
        .in('id', topAccountIds);
      if (accountsRes.error) throw new Error(accountsRes.error.message);
      for (const row of accountsRes.data ?? []) {
        accountsById.set(String(row.id), {
          name: String(row.name ?? 'Account'),
          slug: String(row.slug ?? ''),
        });
      }
    }

    const topAiAccounts: AiAccountCostRow[] = topAccountIds.map((id) => {
      const agg = byAccount.get(id)!;
      const account = accountsById.get(id);
      return {
        accountId: id,
        accountName: account?.name ?? 'Account',
        accountSlug: account?.slug ?? '',
        creditsUsed: agg.credits,
        inputTokens: agg.inputTokens,
        outputTokens: agg.outputTokens,
        estimatedCostUsd: agg.costUsd,
      };
    });

    return {
      periodStart: periodStartIso,
      periodEnd: periodEndIso,
      periodMonth,
      estimatedMrrMinor: Math.round(estimatedMrrMinor),
      mrrCurrency,
      activePayingWorkspaces,
      aiPackRevenueMinor,
      aiPackRevenueCurrency,
      aiCreditsUsed,
      aiInputTokens,
      aiOutputTokens,
      aiEstimatedCostUsd,
      aiByFeature: [...byFeature.entries()]
        .map(([feature, v]) => ({
          feature,
          credits: v.credits,
          costUsd: v.costUsd,
        }))
        .sort((a, b) => b.costUsd - a.costUsd),
      aiByModel: [...byModel.entries()]
        .map(([model, v]) => ({
          model,
          credits: v.credits,
          costUsd: v.costUsd,
        }))
        .sort((a, b) => b.costUsd - a.costUsd),
      topAiAccounts,
      operatingCosts,
      operatingCostsTotalMinor,
      operatingCostsCurrency,
      modelRates,
      opexPerPayingWorkspaceMinor:
        activePayingWorkspaces > 0
          ? Math.round(operatingCostsTotalMinor / activePayingWorkspaces)
          : null,
      aiCostPerPayingWorkspaceUsd:
        activePayingWorkspaces > 0
          ? aiEstimatedCostUsd / activePayingWorkspaces
          : null,
    };
  },
);

export function formatMoneyMinor(
  minor: number,
  currency: string,
  locale = 'en-GB',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}
