'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { LISTING_STATUS_LABELS } from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import type {
  CommercialProperty,
  CommercialPropertyParty,
} from '../_lib/server/commercial-properties.service';
import { updateCommercialProperty } from '../_lib/server/server-actions';
import { CommercialPropertyPartiesCard } from './commercial-property-parties-card';

export function CommercialPropertyDetail({
  accountId,
  accountSlug,
  property: initialProperty,
  parties,
  linkedListings,
}: {
  accountId: string;
  accountSlug: string;
  property: CommercialProperty;
  parties: CommercialPropertyParty[];
  linkedListings: Array<{ id: string; name: string; status: string }>;
}) {
  const [property, setProperty] = useState(initialProperty);
  const [name, setName] = useState(property.name);
  const [addressLine1, setAddressLine1] = useState(property.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(property.addressLine2 ?? '');
  const [town, setTown] = useState(property.town ?? '');
  const [postcode, setPostcode] = useState(property.postcode ?? '');
  const [notes, setNotes] = useState(property.notes ?? '');
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      try {
        const updated = await updateCommercialProperty({
          accountId,
          propertyId: property.id,
          name: name.trim(),
          addressLine1: addressLine1.trim() || null,
          addressLine2: addressLine2.trim() || null,
          town: town.trim() || null,
          postcode: postcode.trim() || null,
          notes: notes.trim() || null,
        });
        setProperty(updated);
        toast.success('Property saved');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save');
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <div className="space-y-4">
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Property details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="detail-name">Name</Label>
              <Input
                id="detail-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="detail-address-1">Address line 1</Label>
              <Input
                id="detail-address-1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="detail-address-2">Address line 2</Label>
              <Input
                id="detail-address-2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="detail-town">Town</Label>
                <Input
                  id="detail-town"
                  value={town}
                  onChange={(e) => setTown(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="detail-postcode">Postcode</Label>
                <Input
                  id="detail-postcode"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="detail-notes">Notes</Label>
              <Input
                id="detail-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
              />
            </div>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending}
              onClick={save}
            >
              Save property
            </Button>
          </CardContent>
        </Card>

        <CommercialPropertyPartiesCard
          accountId={accountId}
          accountSlug={accountSlug}
          propertyId={property.id}
          initialParties={parties}
        />
      </div>

      <aside className="space-y-4">
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-sm text-[var(--workspace-shell-text)]">
              Linked disposals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {linkedListings.length === 0 ? (
              <p className="text-sm text-[var(--workspace-shell-text)]/50">
                No disposals linked. This property can exist without being on
                the market.
              </p>
            ) : (
              linkedListings.map((listing) => (
                <Link
                  key={listing.id}
                  href={pathsConfig.app.accountListingDetail
                    .replace('[account]', accountSlug)
                    .replace('[id]', listing.id)}
                  className="block rounded-lg px-2 py-2 text-sm hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  <span className="font-medium text-[var(--workspace-shell-text)]">
                    {listing.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text)]/45">
                    {LISTING_STATUS_LABELS[
                      listing.status as keyof typeof LISTING_STATUS_LABELS
                    ] ?? listing.status}
                  </span>
                </Link>
              ))
            )}
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <Link
                href={pathsConfig.app.accountListingNew.replace(
                  '[account]',
                  accountSlug,
                )}
                prefetch={false}
              >
                Create disposal
              </Link>
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
