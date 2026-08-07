'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Building2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';

import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import type {
  CoAgentClientOption,
  ListingCoAgent,
} from '../_lib/server/listings.service';
import {
  addListingCoAgent,
  removeListingCoAgent,
  searchCoAgentClients,
} from '../_lib/server/server-actions';

export function ListingCoAgentsCard({
  accountId,
  listingId,
  initialCoAgents,
}: {
  accountId: string;
  listingId: string;
  initialCoAgents: ListingCoAgent[];
}) {
  const [coAgents, setCoAgents] = useState(initialCoAgents);
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
          const rows = await searchCoAgentClients({
            accountId,
            query: q,
            excludeListingId: listingId,
          });
          setResults(rows);
        } catch (err) {
          console.error(err);
        }
      });
    }, 220);

    return () => window.clearTimeout(handle);
  }, [accountId, listingId, query]);

  const linkedIds = useMemo(
    () => new Set(coAgents.map((a) => a.clientId)),
    [coAgents],
  );

  const addExisting = (client: CoAgentClientOption) => {
    startTransition(async () => {
      try {
        const next = await addListingCoAgent({
          accountId,
          listingId,
          clientId: client.id,
        });
        setCoAgents(next);
        setQuery('');
        setResults([]);
        toast.success(`Linked ${client.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not link agent');
      }
    });
  };

  const createAndLink = () => {
    const firm = companyName.trim();
    if (!firm) {
      toast.error('Enter the agency name');
      return;
    }

    startTransition(async () => {
      try {
        const next = await addListingCoAgent({
          accountId,
          listingId,
          companyName: firm,
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
        });
        setCoAgents(next);
        setShowCreate(false);
        setCompanyName('');
        setContactName('');
        setContactEmail('');
        setContactPhone('');
        toast.success(`Added ${firm} as co-marketing agent`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not add agent');
      }
    });
  };

  const remove = (agent: ListingCoAgent) => {
    startTransition(async () => {
      try {
        const next = await removeListingCoAgent({
          accountId,
          listingId,
          coAgentId: agent.id,
        });
        setCoAgents(next);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not remove agent',
        );
      }
    });
  };

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Co-marketing agents
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          Link another agency from Clients to jointly market this disposal.
          Linking sets instruction nature to joint.
        </p>
      </CardHeader>
      <CardContent className="max-w-lg space-y-4">
        <div className="space-y-2">
          <Label htmlFor="co-agent-search">Add from clients</Label>
          <Input
            id="co-agent-search"
            placeholder="Search agencies or contacts…"
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
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
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
              New agency client
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="co-agent-company">Agency name</Label>
              <Input
                id="co-agent-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Smith & Partners"
                disabled={pending}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="co-agent-contact">Contact name</Label>
                <Input
                  id="co-agent-contact"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-agent-email">Email</Label>
                <Input
                  id="co-agent-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-agent-phone">Phone</Label>
                <Input
                  id="co-agent-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending}
                className={workspaceBtnPrimaryMd}
                onClick={createAndLink}
              >
                Add co-marketing agent
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
            disabled={pending}
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            Create new agency client
          </Button>
        )}

        <ul className="space-y-2">
          {coAgents.length === 0 ? (
            <li className="text-sm text-[var(--workspace-shell-text)]/45">
              No co-marketing agents linked yet.
            </li>
          ) : (
            coAgents.map((agent) => (
              <li
                key={agent.id}
                className="flex items-start gap-2 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-2"
              >
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text)]/40" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {agent.clientName}
                  </p>
                  {agent.contactName || agent.contactEmail ? (
                    <p className="truncate text-xs text-[var(--workspace-shell-text)]/50">
                      {[agent.contactName, agent.contactEmail]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  className="h-7 w-7 shrink-0"
                  onClick={() => remove(agent)}
                  aria-label={`Remove ${agent.clientName}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
