'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { PlusCircle } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  LISTING_STATUS_LABELS,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';

import type {
  ClientCommercialDisposalRow,
  ClientCommercialLeaseRow,
  ClientCommercialRequirementRow,
  ClientCommercialSaleRow,
  ClientCommercialViewingRow,
} from '../_lib/server/client-commercial.service';
import {
  listClientDisposals,
  listClientLeases,
  listClientRequirements,
  listClientSales,
  listClientViewings,
} from '../_lib/server/server-actions';

function formatStatus(status: string): string {
  return (
    LISTING_STATUS_LABELS[status as ListingStatus] ??
    status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function EmptyState({
  message,
  ctaLabel,
  ctaHref,
}: {
  message: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center">
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        {message}
      </p>
      <Button
        asChild
        size="sm"
        className="mt-3 bg-[var(--ozer-accent)] text-xs hover:bg-[var(--ozer-accent-hover)]"
      >
        <Link href={ctaHref}>
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
          {ctaLabel}
        </Link>
      </Button>
    </div>
  );
}

function RowLink({
  href,
  title,
  meta,
  status,
}: {
  href: string;
  title: string;
  meta?: string | null;
  status: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2.5 text-sm transition hover:bg-[var(--workspace-shell-panel-hover)]"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--workspace-shell-text)]">
          {title}
        </p>
        {meta ? (
          <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
            {meta}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)]">
        {formatStatus(status)}
      </span>
    </Link>
  );
}

type BlockProps = {
  accountSlug: string;
  accountId: string;
  clientId: string;
  canEdit?: boolean;
};

export function ClientDisposalsBlock({
  accountSlug,
  accountId,
  clientId,
}: BlockProps) {
  const [rows, setRows] = useState<ClientCommercialDisposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const listHref = `${pathsConfig.app.accountListings.replace('[account]', accountSlug)}?create=1`;
  const detailBase = pathsConfig.app.accountListingDetail.replace(
    '[account]',
    accountSlug,
  );

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClientDisposals({ accountId, clientId });
      setRows(data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Loading…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        message="No disposals linked to this contact yet."
        ctaLabel="Add disposal"
        ctaHref={listHref}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id}>
          <RowLink
            href={detailBase.replace('[id]', row.id)}
            title={row.name}
            meta={
              row.relation === 'instructing' ? 'Instructing client' : 'Party'
            }
            status={row.status}
          />
        </li>
      ))}
    </ul>
  );
}

export function ClientRequirementsBlock({
  accountSlug,
  accountId,
  clientId,
}: BlockProps) {
  const [rows, setRows] = useState<ClientCommercialRequirementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const listHref = `${pathsConfig.app.accountRequirements.replace('[account]', accountSlug)}?create=1`;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClientRequirements({ accountId, clientId });
      setRows(data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Loading…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        message="No requirements linked to this contact yet."
        ctaLabel="Add requirement"
        ctaHref={listHref}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id}>
          <RowLink
            href={`${pathsConfig.app.accountRequirements.replace('[account]', accountSlug)}`}
            title={row.title}
            meta={row.meta ?? formatDate(row.updatedAt)}
            status={row.stage}
          />
        </li>
      ))}
    </ul>
  );
}

export function ClientViewingsBlock({
  accountSlug,
  accountId,
  clientId,
}: BlockProps) {
  const [rows, setRows] = useState<ClientCommercialViewingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const listHref = pathsConfig.app.accountViewings.replace(
    '[account]',
    accountSlug,
  );
  const listingDetail = pathsConfig.app.accountListingDetail.replace(
    '[account]',
    accountSlug,
  );

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClientViewings({ accountId, clientId });
      setRows(data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Loading…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        message="No viewings linked to this contact yet."
        ctaLabel="Open viewings"
        ctaHref={listHref}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id}>
          <RowLink
            href={
              row.listingId
                ? listingDetail.replace('[id]', row.listingId)
                : listHref
            }
            title={row.listingName || 'Viewing'}
            meta={formatDate(row.scheduledAt)}
            status={row.status}
          />
        </li>
      ))}
    </ul>
  );
}

export function ClientLeasesBlock({
  accountSlug,
  accountId,
  clientId,
}: BlockProps) {
  const [rows, setRows] = useState<ClientCommercialLeaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const listHref = pathsConfig.app.accountLeases.replace(
    '[account]',
    accountSlug,
  );

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClientLeases({ accountId, clientId });
      setRows(data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Loading…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        message="No leases linked to this contact yet."
        ctaLabel="Open Sales & lettings"
        ctaHref={listHref}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id}>
          <RowLink
            href={listHref}
            title={row.propertyLabel || row.listingName || 'Lease'}
            meta={formatDate(row.updatedAt)}
            status={row.status}
          />
        </li>
      ))}
    </ul>
  );
}

export function ClientSalesBlock({
  accountSlug,
  accountId,
  clientId,
}: BlockProps) {
  const [rows, setRows] = useState<ClientCommercialSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const leasesHref = pathsConfig.app.accountLeases.replace(
    '[account]',
    accountSlug,
  );
  const listingDetail = pathsConfig.app.accountListingDetail.replace(
    '[account]',
    accountSlug,
  );

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClientSales({ accountId, clientId });
      setRows(data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Loading…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        message="No completed sales or lettings linked to this contact yet."
        ctaLabel="Open Sales & lettings"
        ctaHref={leasesHref}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={`${row.kind}-${row.id}`}>
          <RowLink
            href={
              row.hrefKind === 'listing'
                ? listingDetail.replace('[id]', row.id)
                : leasesHref
            }
            title={row.title}
            meta={`${row.kind === 'disposal' ? 'Disposal' : 'Lease'} · ${formatDate(row.updatedAt)}`}
            status={row.status}
          />
        </li>
      ))}
    </ul>
  );
}
