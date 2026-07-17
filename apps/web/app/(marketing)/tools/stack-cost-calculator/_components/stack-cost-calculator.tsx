'use client';

import { useCallback, useMemo, useState } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

import { MarketingFaqsSection } from '~/(marketing)/_components/marketing-faqs';
import { formatGbp } from '~/lib/billing/billing-config-prices';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingFeatureCard,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';
import {
  CALCULATOR_FAQS,
  STACK_TOOLS,
  type StackTool,
  ozerAnnualFromBilling,
  ozerMonthlyFromBilling,
} from '~/lib/marketing/stack-calculator-data';

type ToolState = {
  on: boolean;
  monthly: number;
  seats: number;
};

function parseState(params: URLSearchParams): {
  tools: Record<string, ToolState>;
  revenue: number;
  transactions: number;
  includeFees: boolean;
} {
  const tools: Record<string, ToolState> = {};
  for (const tool of STACK_TOOLS) {
    const on = params.get(tool.id) === '1' || params.get(tool.id) === 'true';
    const monthly = Number(
      params.get(`${tool.id}_m`) ?? tool.defaultMonthlyGbp,
    );
    const seats = Number(params.get(`${tool.id}_s`) ?? tool.defaultSeats);
    tools[tool.id] = {
      on: params.has(tool.id) ? on : false,
      monthly: Number.isFinite(monthly) ? monthly : tool.defaultMonthlyGbp,
      seats: Number.isFinite(seats) && seats > 0 ? seats : tool.defaultSeats,
    };
  }

  // Default: turn on a typical stack when no params
  if (![...params.keys()].some((k) => STACK_TOOLS.some((t) => k === t.id))) {
    for (const tool of STACK_TOOLS) {
      tools[tool.id] = {
        on: true,
        monthly: tool.defaultMonthlyGbp,
        seats: tool.defaultSeats,
      };
    }
  }

  const revenue = Number(params.get('rev') ?? 40000);
  const transactions = Number(params.get('txn') ?? 80);
  const includeFees = params.get('fees') === '1';

  return {
    tools,
    revenue: Number.isFinite(revenue) ? revenue : 40000,
    transactions: Number.isFinite(transactions) ? transactions : 80,
    includeFees,
  };
}

function buildParams(state: {
  tools: Record<string, ToolState>;
  revenue: number;
  transactions: number;
  includeFees: boolean;
}): URLSearchParams {
  const params = new URLSearchParams();
  for (const tool of STACK_TOOLS) {
    const row = state.tools[tool.id];
    if (!row) continue;
    if (row.on) params.set(tool.id, '1');
    params.set(`${tool.id}_m`, String(row.monthly));
    if (tool.perSeat) params.set(`${tool.id}_s`, String(row.seats));
  }
  params.set('rev', String(state.revenue));
  params.set('txn', String(state.transactions));
  if (state.includeFees) params.set('fees', '1');
  return params;
}

function toolMonthly(tool: StackTool, state: ToolState): number {
  if (!state.on) return 0;
  return tool.perSeat ? state.monthly * state.seats : state.monthly;
}

/** 2.9% + £0.20 per transaction (25¢-style fee, stated in £). */
function cardFeeGbp(revenue: number, transactions: number): number {
  return revenue * 0.029 + transactions * 0.2;
}

export function StackCostCalculatorClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = useMemo(
    () => parseState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [tools, setTools] = useState(initial.tools);
  const [revenue, setRevenue] = useState(initial.revenue);
  const [transactions, setTransactions] = useState(initial.transactions);
  const [includeFees, setIncludeFees] = useState(initial.includeFees);
  const [copied, setCopied] = useState(false);

  const ozerAnnual = ozerAnnualFromBilling();
  const ozerMonthly = ozerMonthlyFromBilling();

  const stackMonthly = useMemo(() => {
    let total = 0;
    for (const tool of STACK_TOOLS) {
      const row = tools[tool.id];
      if (row) total += toolMonthly(tool, row);
    }
    if (includeFees) total += cardFeeGbp(revenue, transactions) / 12;
    return total;
  }, [tools, includeFees, revenue, transactions]);

  const stackAnnual = stackMonthly * 12;

  const syncUrl = useCallback(
    (next: {
      tools: Record<string, ToolState>;
      revenue: number;
      transactions: number;
      includeFees: boolean;
    }) => {
      const params = buildParams(next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const update = (
    patch: Partial<{
      tools: Record<string, ToolState>;
      revenue: number;
      transactions: number;
      includeFees: boolean;
    }>,
  ) => {
    const next = {
      tools: patch.tools ?? tools,
      revenue: patch.revenue ?? revenue,
      transactions: patch.transactions ?? transactions,
      includeFees: patch.includeFees ?? includeFees,
    };
    if (patch.tools) setTools(patch.tools);
    if (patch.revenue != null) setRevenue(patch.revenue);
    if (patch.transactions != null) setTransactions(patch.transactions);
    if (patch.includeFees != null) setIncludeFees(patch.includeFees);
    syncUrl(next);
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${pathname}?${buildParams({
          tools,
          revenue,
          transactions,
          includeFees,
        }).toString()}`
      : '';

  const copyShare = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const categories = [...new Set(STACK_TOOLS.map((t) => t.category))];

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="font-heading text-lg font-semibold text-[var(--workspace-shell-text)]">
                {category}
              </h2>
              <ul className="mt-3 space-y-3">
                {STACK_TOOLS.filter((t) => t.category === category).map(
                  (tool) => {
                    const row = tools[tool.id]!;
                    return (
                      <li
                        key={tool.id}
                        className={cn(
                          'rounded-xl border border-[color:var(--workspace-shell-border)] p-4',
                          marketingFeatureCard,
                        )}
                      >
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={row.on}
                            onChange={(e) => {
                              update({
                                tools: {
                                  ...tools,
                                  [tool.id]: { ...row, on: e.target.checked },
                                },
                              });
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-[var(--workspace-shell-text)]">
                              {tool.name}
                            </span>
                            <span className="mt-2 flex flex-wrap gap-3">
                              <span>
                                <Label
                                  htmlFor={`${tool.id}-m`}
                                  className={cn('text-xs', marketingMutedText)}
                                >
                                  £ per month{tool.perSeat ? ' per seat' : ''}
                                </Label>
                                <Input
                                  id={`${tool.id}-m`}
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={row.monthly}
                                  disabled={!row.on}
                                  className="mt-1 h-9 w-28"
                                  onChange={(e) => {
                                    update({
                                      tools: {
                                        ...tools,
                                        [tool.id]: {
                                          ...row,
                                          monthly: Number(e.target.value) || 0,
                                        },
                                      },
                                    });
                                  }}
                                />
                              </span>
                              {tool.perSeat ? (
                                <span>
                                  <Label
                                    htmlFor={`${tool.id}-s`}
                                    className={cn(
                                      'text-xs',
                                      marketingMutedText,
                                    )}
                                  >
                                    Seats
                                  </Label>
                                  <Input
                                    id={`${tool.id}-s`}
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={row.seats}
                                    disabled={!row.on}
                                    className="mt-1 h-9 w-20"
                                    onChange={(e) => {
                                      update({
                                        tools: {
                                          ...tools,
                                          [tool.id]: {
                                            ...row,
                                            seats: Math.max(
                                              1,
                                              Number(e.target.value) || 1,
                                            ),
                                          },
                                        },
                                      });
                                    }}
                                  />
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  },
                )}
              </ul>
            </section>
          ))}

          <section
            className={cn(
              'rounded-xl border border-[color:var(--workspace-shell-border)] p-4',
              marketingFeatureCard,
            )}
          >
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={includeFees}
                onChange={(e) => update({ includeFees: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-[var(--workspace-shell-text)]">
                  Card fees on tools that take a cut (2.9% + £0.20 per
                  transaction)
                </span>
                <span
                  className={cn(
                    'mt-2 flex flex-wrap gap-3',
                    !includeFees && 'opacity-50',
                  )}
                >
                  <span>
                    <Label
                      htmlFor="rev"
                      className={cn('text-xs', marketingMutedText)}
                    >
                      Annual card revenue (£)
                    </Label>
                    <Input
                      id="rev"
                      type="number"
                      min={0}
                      value={revenue}
                      disabled={!includeFees}
                      className="mt-1 h-9 w-36"
                      onChange={(e) =>
                        update({ revenue: Number(e.target.value) || 0 })
                      }
                    />
                  </span>
                  <span>
                    <Label
                      htmlFor="txn"
                      className={cn('text-xs', marketingMutedText)}
                    >
                      Transactions per year
                    </Label>
                    <Input
                      id="txn"
                      type="number"
                      min={0}
                      value={transactions}
                      disabled={!includeFees}
                      className="mt-1 h-9 w-28"
                      onChange={(e) =>
                        update({ transactions: Number(e.target.value) || 0 })
                      }
                    />
                  </span>
                </span>
              </span>
            </label>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div
            className={cn(
              'rounded-2xl border border-[color:var(--workspace-shell-border)] p-6',
              marketingFeatureCard,
            )}
          >
            <p
              className={cn(
                'text-xs font-semibold tracking-wide uppercase',
                marketingMutedText,
              )}
            >
              Shareable summary
            </p>
            <p className="font-heading mt-3 text-2xl font-bold text-[var(--workspace-shell-text)]">
              My stack costs {formatGbp(Math.round(stackAnnual))}/year
            </p>
            <p className={cn('mt-2 text-sm', marketingBodyText)}>
              That is {formatGbp(Math.round(stackMonthly))} per month with your
              current selections.
            </p>
            <div className="mt-6 border-t border-[color:var(--workspace-shell-border)] pt-4">
              <p className="text-sm text-[var(--workspace-shell-text)]">
                Ozer Business Team:{' '}
                <strong>{formatGbp(ozerAnnual)}/year</strong> (
                {formatGbp(ozerMonthly)} per month), flat price for the whole
                team (up to 5 members).
              </p>
              <p className={cn('mt-2 text-sm', marketingMutedText)}>
                Difference:{' '}
                {stackAnnual >= ozerAnnual
                  ? `${formatGbp(Math.round(stackAnnual - ozerAnnual))}/year higher than Ozer`
                  : `${formatGbp(Math.round(ozerAnnual - stackAnnual))}/year lower than Ozer`}
                .
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                type="button"
                className={marketingBtnGradient}
                onClick={copyShare}
              >
                {copied ? 'Link copied' : 'Copy shareable link'}
              </Button>
              <Button asChild variant="outline" className={marketingBtnOutline}>
                <a href="/pricing">See Ozer pricing</a>
              </Button>
            </div>
            <p className={cn('mt-4 text-xs', marketingMutedText)}>
              Selections live in the URL only — nothing is stored in your
              browser profile.
            </p>
          </div>
        </aside>
      </div>

      <MarketingFaqsSection
        faqs={CALCULATOR_FAQS}
        tone="light"
        title="Calculator FAQ"
        headingId="stack-calc-faq"
      />
    </div>
  );
}
