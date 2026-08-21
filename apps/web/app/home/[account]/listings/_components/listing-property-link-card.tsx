'use client';

import { useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import { Building2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import type { CommercialPropertyOption } from '../../commercial-properties/_lib/server/commercial-properties.service';
import {
  createCommercialPropertyFromListing,
  linkListingToCommercialProperty,
  searchCommercialProperties,
} from '../../commercial-properties/_lib/server/server-actions';

export function ListingPropertyLinkCard({
  accountId,
  accountSlug,
  listingId,
  initialPropertyId,
  initialPropertyName,
}: {
  accountId: string;
  accountSlug: string;
  listingId: string;
  initialPropertyId: string | null;
  initialPropertyName?: string | null;
}) {
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [propertyName, setPropertyName] = useState(initialPropertyName ?? null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommercialPropertyOption[]>([]);
  const [pending, startTransition] = useTransition();
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      startSearch(async () => {
        try {
          const rows = await searchCommercialProperties({
            accountId,
            query: q,
          });
          setResults(rows);
        } catch (err) {
          console.error(err);
        }
      });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [accountId, query]);

  const link = (option: CommercialPropertyOption) => {
    startTransition(async () => {
      try {
        await linkListingToCommercialProperty({
          accountId,
          listingId,
          propertyId: option.id,
        });
        setPropertyId(option.id);
        setPropertyName(option.name);
        setQuery('');
        setResults([]);
        toast.success(`Linked to ${option.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not link');
      }
    });
  };

  const unlink = () => {
    startTransition(async () => {
      try {
        await linkListingToCommercialProperty({
          accountId,
          listingId,
          propertyId: null,
        });
        setPropertyId(null);
        setPropertyName(null);
        toast.success('Unlinked property');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not unlink');
      }
    });
  };

  const createFromListing = () => {
    startTransition(async () => {
      try {
        const property = await createCommercialPropertyFromListing({
          accountId,
          listingId,
        });
        setPropertyId(property.id);
        setPropertyName(property.name);
        toast.success('Property created from this disposal');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not create');
      }
    });
  };

  const propertyHref = propertyId
    ? pathsConfig.app.accountCommercialPropertyDetail
        .replace('[account]', accountSlug)
        .replace('[id]', propertyId)
    : null;

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          CRM property
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          Link this disposal to a property asset (or create one). Properties can
          exist without a disposal.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {propertyId && propertyHref ? (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-2">
            <Building2 className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text)]/40" />
            <Link
              href={propertyHref}
              className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--workspace-shell-text)] hover:underline"
            >
              {propertyName || 'Linked property'}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={unlink}
            >
              Unlink
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="link-property-search">
                Link existing property
              </Label>
              <Input
                id="link-property-search"
                placeholder="Search by name or postcode…"
                value={query}
                disabled={pending}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.trim() && (searching || results.length > 0) ? (
                <ul className="max-h-40 overflow-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
                  {results.slice(0, 8).map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        disabled={pending}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--workspace-shell-sidebar-accent)]"
                        onClick={() => link(row)}
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text)]/40" />
                        <span className="min-w-0 flex-1 truncate">
                          {row.name}
                        </span>
                        <span className="text-xs text-[var(--workspace-shell-text)]/45">
                          {[row.town, row.postcode].filter(Boolean).join(', ')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending}
              onClick={createFromListing}
            >
              Create property from this address
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
