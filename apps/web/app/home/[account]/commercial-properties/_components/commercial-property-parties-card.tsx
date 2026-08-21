'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { Mail, Phone, Plus, UserRound, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  PROPERTY_PARTY_ROLES,
  PROPERTY_PARTY_ROLE_LABELS,
  type PropertyPartyRole,
} from '~/lib/commercial/commercial-constants';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

import type {
  CommercialPropertyParty,
  PropertyPartyClientOption,
} from '../_lib/server/commercial-properties.service';
import {
  addCommercialPropertyParty,
  removeCommercialPropertyParty,
  searchPropertyPartyClients,
} from '../_lib/server/server-actions';

export function CommercialPropertyPartiesCard({
  accountId,
  accountSlug,
  propertyId,
  initialParties,
}: {
  accountId: string;
  accountSlug: string;
  propertyId: string;
  initialParties: CommercialPropertyParty[];
}) {
  const [parties, setParties] = useState(initialParties);
  const [role, setRole] = useState<PropertyPartyRole>('landlord');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PropertyPartyClientOption[]>([]);
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
          const rows = await searchPropertyPartyClients({
            accountId,
            query: q,
            excludePropertyId: propertyId,
            role,
          });
          setResults(rows);
        } catch (err) {
          console.error(err);
        }
      });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [accountId, propertyId, query, role]);

  const linkedKeys = useMemo(
    () => new Set(parties.map((p) => `${p.clientId}:${p.role}`)),
    [parties],
  );

  const addExisting = (option: PropertyPartyClientOption) => {
    startTransition(async () => {
      try {
        const next = await addCommercialPropertyParty({
          accountId,
          propertyId,
          role,
          clientId: option.id,
          contactId: option.contactId ?? null,
          contactName: option.contactName ?? null,
          contactEmail: option.email,
          contactPhone: option.phone,
        });
        setParties(next);
        setQuery('');
        setResults([]);
        toast.success(`Linked ${option.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not link');
      }
    });
  };

  const createAndLink = () => {
    if (!companyName.trim()) {
      toast.error('Enter a company or contact name');
      return;
    }
    startTransition(async () => {
      try {
        const next = await addCommercialPropertyParty({
          accountId,
          propertyId,
          role,
          companyName: companyName.trim(),
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
        toast.success('Contact linked to property');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not add');
      }
    });
  };

  const remove = (party: CommercialPropertyParty) => {
    startTransition(async () => {
      try {
        const next = await removeCommercialPropertyParty({
          accountId,
          propertyId,
          partyId: party.id,
        });
        setParties(next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not remove');
      }
    });
  };

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          People
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          Landlords, tenants, managers and others linked to this property — with
          phone numbers for quick calls.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as PropertyPartyRole)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                {PROPERTY_PARTY_ROLES.map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                    className={workspaceSelectItemClass}
                  >
                    {PROPERTY_PARTY_ROLE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="property-party-search">Add from contacts</Label>
            <Input
              id="property-party-search"
              placeholder="Search companies or people…"
              value={query}
              disabled={pending}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query.trim() && (searching || results.length > 0) ? (
              <ul className="max-h-44 overflow-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
                {results
                  .filter((row) => !linkedKeys.has(`${row.id}:${role}`))
                  .slice(0, 8)
                  .map((row) => (
                    <li key={`${row.id}:${row.contactId ?? 'c'}`}>
                      <button
                        type="button"
                        disabled={pending}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--workspace-shell-sidebar-accent)]"
                        onClick={() => addExisting(row)}
                      >
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text)]/40" />
                        <span className="min-w-0 flex-1 truncate">
                          {row.name}
                        </span>
                        {row.phone ? (
                          <span className="text-xs text-[var(--workspace-shell-text)]/45">
                            {row.phone}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                {!searching && results.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[var(--workspace-shell-text)]/45">
                    No matching contacts
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>

        {showCreate ? (
          <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
            <Input
              placeholder="Company or contact name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={pending}
            />
            <Input
              placeholder="Person name (optional)"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={pending}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                disabled={pending}
              />
              <Input
                placeholder="Phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className={workspaceBtnPrimaryMd}
                disabled={pending}
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create contact
          </Button>
        )}

        <ul className="space-y-2">
          {parties.length === 0 ? (
            <li className="text-sm text-[var(--workspace-shell-text)]/45">
              No people linked yet.
            </li>
          ) : (
            parties.map((party) => {
              const clientHref = `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}/${party.clientId}`;
              const phone = party.displayPhone;
              const email = party.contactEmail;
              return (
                <li
                  key={party.id}
                  className="flex items-start gap-2 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-2"
                >
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text)]/40" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={clientHref}
                        className="truncate text-sm font-medium text-[var(--workspace-shell-text)] hover:underline"
                      >
                        {party.contactName
                          ? `${party.contactName} · ${party.clientName}`
                          : party.clientName}
                      </Link>
                      <span className="text-[10px] tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
                        {PROPERTY_PARTY_ROLE_LABELS[party.role]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--workspace-shell-text)]/60">
                      {phone ? (
                        <a
                          href={`tel:${phone}`}
                          className="inline-flex items-center gap-1 hover:text-[var(--workspace-shell-text)]"
                        >
                          <Phone className="h-3 w-3" />
                          {phone}
                        </a>
                      ) : null}
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="inline-flex items-center gap-1 hover:text-[var(--workspace-shell-text)]"
                        >
                          <Mail className="h-3 w-3" />
                          {email}
                        </a>
                      ) : null}
                      {!phone && !email ? (
                        <span>No phone or email on file</span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    className="h-7 w-7 shrink-0"
                    onClick={() => remove(party)}
                    aria-label={`Remove ${party.clientName}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
