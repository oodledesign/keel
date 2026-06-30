'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import { BrandVisibilityLayerPanel } from '~/home/[account]/(rankly)/_components/brand-visibility-layers';
import type { SiteOverviewSnapshot } from '~/lib/site-overview/types';

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

function formatDelta(value: number | null): string | null {
  if (value == null || value === 0) return null;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toLocaleString()}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function MetricCard(props: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string | null;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{props.value}</p>
      {props.sub ? (
        <p className="text-muted-foreground mt-1 text-xs">{props.sub}</p>
      ) : null}
      {props.delta ? (
        <p
          className={
            props.delta.startsWith('-')
              ? 'mt-1 text-xs text-red-400'
              : 'mt-1 text-xs text-[var(--ozer-accent)]'
          }
        >
          {props.delta} {props.hint ?? ''}
        </p>
      ) : null}
    </div>
  );
}

export function SiteOverviewPanel(props: {
  accountId: string;
  projectId: string;
  domain: string;
  countryLabel: string;
  overview: SiteOverviewSnapshot | null;
  stale: boolean;
  auditHref: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const refresh = async (force = true) => {
    setLoading(true);
    try {
      const res = await fetch('/api/rankly/site-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: props.projectId,
          accountId: props.accountId,
          force,
        }),
      });
      const json = (await res.json()) as ApiResponse<{
        overview: SiteOverviewSnapshot;
        refreshed: boolean;
        warnings?: string[];
      }>;
      if (!json.ok) throw new Error(json.error.message);
      if (json.data.refreshed) {
        toast.success('Site overview updated');
        if (json.data.warnings?.length) {
          toast.message(json.data.warnings.join(' '));
        }
      } else {
        toast.message('Overview is already up to date');
      }
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const data = props.overview;

  return (
    <section className="space-y-6 rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Site Explorer</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {props.domain} · {props.countryLabel}
          </p>
          {data ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Updated {new Date(data.fetchedAt).toLocaleDateString()}
              {props.stale ? ' · refresh recommended' : ''}
            </p>
          ) : (
            <p className="text-muted-foreground mt-1 text-xs">
              No overview yet — fetch domain metrics from DataForSEO.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => refresh(true)}
        >
          {loading ? 'Refreshing…' : data ? 'Refresh overview' : 'Load overview'}
        </Button>
      </div>

      {!data ? (
        <p className="text-muted-foreground rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm">
          Pull authority, traffic, backlink, and AI visibility metrics for this domain.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Domain Power"
              value={data.domainPower}
              sub={`AR ${data.authorityRank} · LT ${data.linkTrust}`}
            />
            <MetricCard
              label="Brand Signal"
              value={data.brandSignal ?? '—'}
              sub="Rankly composite from AI + authority"
            />
            <MetricCard
              label="AI Overviews"
              value={data.aiOverviewsCount}
              sub="Sampled ranked keywords citing this domain"
            />
            <MetricCard
              label="Page Authority"
              value={data.pageAuthority}
              sub="Rankly equivalent · backlink rank"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Referring domains" value={data.referringDomains.toLocaleString()} />
            <MetricCard label="Backlinks" value={data.backlinksCount.toLocaleString()} />
            <MetricCard
              label="Link Trust"
              value={data.linkTrust}
              sub={`CS ${data.citationStrength}`}
            />
            <MetricCard label="Spam score" value={data.spamScore} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Organic search
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Keywords"
                  value={data.organicKeywords.toLocaleString()}
                  delta={formatDelta(data.organicKeywordsDelta)}
                  hint="vs last refresh"
                />
                <MetricCard
                  label="Traffic"
                  value={data.organicTraffic.toLocaleString()}
                  delta={formatDelta(data.organicTrafficDelta)}
                  hint="ETV / mo"
                />
                <MetricCard
                  label="Value"
                  value={formatCurrency(data.organicValue)}
                  delta={
                    data.organicValueDelta != null
                      ? formatDelta(Math.round(data.organicValueDelta))
                      : null
                  }
                />
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                Top 3 rankings: {data.organicTop3.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Paid search
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Keywords" value={data.paidKeywords.toLocaleString()} />
                <MetricCard label="Traffic" value={data.paidTraffic.toLocaleString()} />
                <MetricCard label="Value" value={formatCurrency(data.paidValue)} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Brand visibility
              </p>
              <p className="text-muted-foreground text-xs">
                Rankly metrics — not Ahrefs DR / Moz DA / Majestic TF
              </p>
            </div>

            <BrandVisibilityLayerPanel
              rows={data.brandVisibility}
              emptyHref={props.auditHref}
            />
          </div>
        </>
      )}
    </section>
  );
}
