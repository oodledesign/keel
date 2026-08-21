'use client';

import Link from 'next/link';

import { Mail, Phone, UserRound } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import { LISTING_PARTY_ROLE_LABELS } from '~/lib/commercial/commercial-constants';
import { workspacePanelCard } from '~/lib/workspace-ui';

import type { ListingParty } from '../_lib/server/listings.service';

export function ListingPeopleStrip({
  accountSlug,
  parties,
  managementHref,
}: {
  accountSlug: string;
  parties: ListingParty[];
  managementHref: string;
}) {
  const visible = parties.filter((party) => !party.isPrivate);

  return (
    <Card className={workspacePanelCard}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          People
        </CardTitle>
        <Link
          href={managementHref}
          className="text-xs text-[var(--workspace-shell-text)]/50 hover:text-[var(--workspace-shell-text)] hover:underline"
        >
          Manage
        </Link>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            No people linked yet.{' '}
            <Link href={managementHref} className="underline">
              Add landlords and contacts
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.slice(0, 6).map((party) => {
              const phone = party.displayPhone;
              const email = party.contactEmail;
              const clientHref = `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}/${party.clientId}`;
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
                        {LISTING_PARTY_ROLE_LABELS[party.role]}
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
                      ) : (
                        <span>No phone</span>
                      )}
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="inline-flex items-center gap-1 hover:text-[var(--workspace-shell-text)]"
                        >
                          <Mail className="h-3 w-3" />
                          {email}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
