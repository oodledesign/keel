'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Building2, EyeOff, Plus, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import type { ListingPartyRole } from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import type {
  CoAgentClientOption,
  CommercialListing,
  ListingParty,
} from '../_lib/server/listings.service';
import {
  addListingParty,
  removeListingParty,
  searchListingPartyClients,
  updateListing,
  updateListingParty,
} from '../_lib/server/server-actions';

export function ListingPartiesCard({
  accountId,
  listingId,
  role,
  initialParties,
  listing,
}: {
  accountId: string;
  listingId: string;
  role: ListingPartyRole;
  initialParties: ListingParty[];
  listing?: CommercialListing;
}) {
  const isLandlord = role === 'landlord';
  const [parties, setParties] = useState(initialParties);
  const [hideLandlord, setHideLandlord] = useState(
    listing?.hideLandlordFromMarketing ?? false,
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoAgentClientOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
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
          const rows = await searchListingPartyClients({
            accountId,
            query: q,
            excludeListingId: listingId,
            role,
          });
          setResults(rows);
        } catch (err) {
          console.error(err);
        }
      });
    }, 220);

    return () => window.clearTimeout(handle);
  }, [accountId, listingId, query, role]);

  const linkedIds = useMemo(
    () => new Set(parties.map((p) => p.clientId)),
    [parties],
  );

  const addExisting = (client: CoAgentClientOption) => {
    startTransition(async () => {
      try {
        const next = await addListingParty({
          accountId,
          listingId,
          role,
          clientId: client.id,
        });
        setParties(next);
        setQuery('');
        setResults([]);
        toast.success(`Linked ${client.name}`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not link party',
        );
      }
    });
  };

  const createAndLink = () => {
    const firm = companyName.trim();
    if (!firm) {
      toast.error('Enter a company or contact name');
      return;
    }

    startTransition(async () => {
      try {
        const next = await addListingParty({
          accountId,
          listingId,
          role,
          companyName: firm,
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
        });
        setParties(next);
        setShowCreate(false);
        setCompanyName('');
        setContactName('');
        setContactEmail('');
        setContactPhone('');
        toast.success(`Added ${firm}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not add');
      }
    });
  };

  const remove = (party: ListingParty) => {
    startTransition(async () => {
      try {
        const next = await removeListingParty({
          accountId,
          listingId,
          partyId: party.id,
        });
        setParties(next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not remove');
      }
    });
  };

  const togglePrivate = (party: ListingParty, nextPrivate: boolean) => {
    startTransition(async () => {
      try {
        const next = await updateListingParty({
          accountId,
          listingId,
          partyId: party.id,
          isPrivate: nextPrivate,
        });
        setParties(next);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not update privacy',
        );
      }
    });
  };

  const toggleHideLandlord = (checked: boolean) => {
    setHideLandlord(checked);
    startTransition(async () => {
      try {
        await updateListing({
          accountId,
          listingId,
          hideLandlordFromMarketing: checked,
        });
      } catch (err) {
        setHideLandlord(!checked);
        toast.error(
          err instanceof Error ? err.message : 'Could not update preference',
        );
      }
    });
  };

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          {isLandlord ? 'Landlords' : 'Other contacts & companies'}
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          {isLandlord
            ? 'Store associated landlords on the disposal.'
            : 'Store associated contacts or companies on the disposal.'}
        </p>
      </CardHeader>
      <CardContent className="max-w-lg space-y-4">
        {isLandlord ? (
          <label className="flex items-start gap-2.5 text-sm text-[var(--workspace-shell-text)]">
            <Checkbox
              checked={hideLandlord}
              disabled={pending}
              onCheckedChange={(value) => toggleHideLandlord(value === true)}
            />
            <span>Hide landlord on marketplace listing?</span>
          </label>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`${role}-party-search`}>Add from clients</Label>
          <Input
            id={`${role}-party-search`}
            placeholder="Search companies or contacts…"
            value={query}
            disabled={pending}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && (searching || results.length > 0) ? (
            <ul className="max-h-44 overflow-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
              {results
                .filter((row) => !linkedIds.has(row.id))
                .slice(0, 8)
                .map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={pending}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--workspace-shell-sidebar-accent)]"
                      onClick={() => addExisting(row)}
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text)]/40" />
                      <span className="min-w-0 flex-1 truncate">
                        {row.name}
                      </span>
                      {row.commercialRole ? (
                        <span className="text-[10px] tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
                          {row.commercialRole}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              {!searching && results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[var(--workspace-shell-text)]/45">
                  No matching clients
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        {showCreate ? (
          <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              New {isLandlord ? 'landlord' : 'company / contact'}
            </p>
            <Input
              placeholder="Company or contact name"
              value={companyName}
              disabled={pending}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Input
              placeholder="Contact name (optional)"
              value={contactName}
              disabled={pending}
              onChange={(e) => setContactName(e.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Email (optional)"
                value={contactEmail}
                disabled={pending}
                onChange={(e) => setContactEmail(e.target.value)}
              />
              <Input
                placeholder="Phone (optional)"
                value={contactPhone}
                disabled={pending}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className={workspaceBtnPrimaryMd}
                disabled={pending || !companyName.trim()}
                onClick={createAndLink}
              >
                Add
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
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add company
            </Button>
          </div>
        )}

        {parties.length === 0 ? (
          <p className="text-sm text-[var(--workspace-shell-text)]/45">
            {isLandlord
              ? 'No landlords associated yet.'
              : 'No contacts or companies associated. You can attach any associated contacts or companies here.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {parties.map((party) => (
              <li
                key={party.id}
                className="flex items-center gap-2 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-2"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text)]/40" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {party.isPrivate ? 'Private' : party.clientName}
                  </p>
                  {!party.isPrivate && party.contactName ? (
                    <p className="truncate text-xs text-[var(--workspace-shell-text)]/50">
                      {party.contactName}
                    </p>
                  ) : null}
                </div>
                {isLandlord ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={pending}
                    title={
                      party.isPrivate ? 'Show landlord name' : 'Mark as private'
                    }
                    onClick={() => togglePrivate(party, !party.isPrivate)}
                  >
                    <EyeOff
                      className={`h-3.5 w-3.5 ${party.isPrivate ? 'text-[var(--ozer-accent)]' : ''}`}
                    />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={pending}
                  onClick={() => remove(party)}
                  aria-label={`Remove ${party.clientName}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
