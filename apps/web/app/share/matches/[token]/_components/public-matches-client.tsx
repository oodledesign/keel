'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { updatePublicMatchSettings } from '../_lib/server/public-matches-actions';

export type PublicMatchesListing = {
  listingId: string;
  name: string;
  summary: string;
  address: string;
  town: string | null;
  sector: string | null;
  disposalTypeLabel: string;
  sizeLabel: string | null;
  viewUrl: string | null;
};

type Brand = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

type Props = {
  token: string;
  email: string;
  contactName: string | null;
  agencyName: string;
  brand: Brand;
  initialUnsubscribed: boolean;
  initialNotifyOnNewMatch: boolean;
  listings: PublicMatchesListing[];
};

export function PublicMatchesClient({
  token,
  email,
  contactName,
  agencyName,
  brand,
  initialUnsubscribed,
  initialNotifyOnNewMatch,
  listings,
}: Props) {
  const [unsubscribed, setUnsubscribed] = useState(initialUnsubscribed);
  const [notifyOnNewMatch, setNotifyOnNewMatch] = useState(
    initialNotifyOnNewMatch,
  );
  const [pending, startTransition] = useTransition();

  function save(next: { unsubscribed: boolean; notifyOnNewMatch: boolean }) {
    const previous = { unsubscribed, notifyOnNewMatch };
    setUnsubscribed(next.unsubscribed);
    setNotifyOnNewMatch(next.notifyOnNewMatch);
    startTransition(async () => {
      try {
        await updatePublicMatchSettings({
          token,
          unsubscribed: next.unsubscribed,
          notifyOnNewMatch: next.notifyOnNewMatch,
        });
        toast.success('Preferences saved');
      } catch (error) {
        setUnsubscribed(previous.unsubscribed);
        setNotifyOnNewMatch(previous.notifyOnNewMatch);
        toast.error(
          error instanceof Error ? error.message : 'Could not save preferences',
        );
      }
    });
  }

  return (
    <main
      className="min-h-screen px-4 py-10 sm:px-6"
      style={{ background: brand.secondaryColor || '#F4F4F1' }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <header
          className="rounded-t-2xl px-6 py-5"
          style={{ background: brand.primaryColor }}
        >
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={agencyName} className="h-10 w-auto" />
          ) : (
            <p className="text-lg font-semibold text-white">{agencyName}</p>
          )}
        </header>

        <section className="rounded-b-2xl border border-[#E4E2DC] bg-white px-6 py-6 shadow-sm">
          <h1 className="text-2xl font-bold text-[#09111F]">
            {contactName ? `Properties for ${contactName}` : 'Your matches'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#3D3D3D]">
            Current commercial opportunities from {agencyName} that match your
            registered requirement. This page is private to {email}.
          </p>

          {listings.length === 0 ? (
            <p className="mt-6 text-sm text-[#6B6B6B]">
              There are no live properties matching your requirement right now.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {listings.map((listing) => (
                <li
                  key={listing.listingId}
                  className="rounded-xl border border-[#E4E2DC] p-4"
                >
                  <h2 className="text-lg font-semibold text-[#09111F]">
                    {listing.name}
                  </h2>
                  <p className="mt-1 text-xs text-[#6B6B6B]">
                    {[listing.disposalTypeLabel, listing.sizeLabel]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {listing.address ? (
                    <p className="mt-1 text-sm text-[#3D3D3D]">
                      {listing.address}
                    </p>
                  ) : null}
                  {listing.summary ? (
                    <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-[#3D3D3D]">
                      {listing.summary}
                    </p>
                  ) : null}
                  {listing.viewUrl ? (
                    <a
                      href={listing.viewUrl}
                      className="mt-3 inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-white"
                      style={{ background: brand.accentColor }}
                    >
                      View details
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 space-y-4 border-t border-[#E4E2DC] pt-6">
            <h2 className="text-base font-semibold text-[#09111F]">
              Email preferences
            </h2>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-[#3D3D3D]">
                Email me when something new matches
              </span>
              <Switch
                checked={!unsubscribed && notifyOnNewMatch}
                disabled={pending || unsubscribed}
                onCheckedChange={(enabled) =>
                  save({ unsubscribed: false, notifyOnNewMatch: enabled })
                }
                data-test="matches-notify-switch"
              />
            </label>
            <Button
              variant={unsubscribed ? 'outline' : 'destructive'}
              disabled={pending}
              onClick={() =>
                save({
                  unsubscribed: !unsubscribed,
                  notifyOnNewMatch: unsubscribed,
                })
              }
              data-test="matches-unsubscribe-button"
            >
              {unsubscribed
                ? 'Resubscribe to matching emails'
                : 'Unsubscribe from matching emails'}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
