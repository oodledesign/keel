'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Building2, Plus, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import type { CommercialProperty } from '../_lib/server/commercial-properties.service';
import { createCommercialProperty } from '../_lib/server/server-actions';

function formatAddress(property: CommercialProperty) {
  return [property.addressLine1, property.town, property.postcode]
    .filter(Boolean)
    .join(', ');
}

export function CommercialPropertiesList({
  accountId,
  accountSlug,
  initialProperties,
}: {
  accountId: string;
  accountSlug: string;
  initialProperties: CommercialProperty[];
}) {
  const router = useRouter();
  const [properties, setProperties] = useState(initialProperties);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [town, setTown] = useState('');
  const [postcode, setPostcode] = useState('');
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((property) => {
      const haystack = [
        property.name,
        property.addressLine1,
        property.town,
        property.postcode,
        property.partySummary,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [properties, query]);

  const create = () => {
    if (!name.trim()) {
      toast.error('Enter a property name');
      return;
    }
    startTransition(async () => {
      try {
        const created = await createCommercialProperty({
          accountId,
          name: name.trim(),
          addressLine1: addressLine1.trim() || null,
          town: town.trim() || null,
          postcode: postcode.trim() || null,
        });
        setProperties((prev) => [created, ...prev]);
        setShowCreate(false);
        setName('');
        setAddressLine1('');
        setTown('');
        setPostcode('');
        toast.success('Property created');
        router.push(
          pathsConfig.app.accountCommercialPropertyDetail
            .replace('[account]', accountSlug)
            .replace('[id]', created.id),
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not create property',
        );
      }
    });
  };

  return (
    <div className="space-y-4 px-3 lg:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text)]/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search properties, postcodes, people…"
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          className={workspaceBtnPrimaryMd}
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          Add property
        </Button>
      </div>

      {showCreate ? (
        <div
          className={`${workspacePanelCard} space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-4`}
        >
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            New property
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="property-name">Name</Label>
              <Input
                id="property-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 12 High Street"
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="property-address">Address</Label>
              <Input
                id="property-address"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="property-town">Town</Label>
              <Input
                id="property-town"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="property-postcode">Postcode</Label>
              <Input
                id="property-postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending}
              onClick={create}
            >
              Create property
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-6 py-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-[var(--workspace-shell-text)]/30" />
          <p className="mt-3 text-sm text-[var(--workspace-shell-text)]/60">
            {query.trim()
              ? 'No properties match your search.'
              : 'No properties yet. Add assets that may or may not be on the market.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)] overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          {filtered.map((property) => {
            const href = pathsConfig.app.accountCommercialPropertyDetail
              .replace('[account]', accountSlug)
              .replace('[id]', property.id);
            return (
              <li key={property.id}>
                <Link
                  href={href}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {property.name}
                    </p>
                    <p className="truncate text-xs text-[var(--workspace-shell-text)]/50">
                      {[formatAddress(property), property.partySummary]
                        .filter(Boolean)
                        .join(' · ') || 'No address yet'}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
                    {(property.disposalCount ?? 0) > 0
                      ? `${property.disposalCount} disposal${(property.disposalCount ?? 0) === 1 ? '' : 's'}`
                      : 'No disposal'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
