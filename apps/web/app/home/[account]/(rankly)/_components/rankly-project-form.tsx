'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import type { RanklyClientImportOption } from '~/home/[account]/_lib/server/rankly-account-data';
import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import { createRanklyProject } from '../_lib/server/rankly-module-actions';

type CreateMode = 'manual' | 'import';

export function RanklyProjectForm(props: {
  accountId: string;
  clientImportOptions: RanklyClientImportOption[];
  clientsHref?: string;
  defaultClientId?: string;
  defaultOpen?: boolean;
  onCreated?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<CreateMode>(
    props.defaultClientId ? 'import' : 'manual',
  );
  const [selectedClientId, setSelectedClientId] = useState(
    props.defaultClientId ?? '',
  );
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [targetCountry, setTargetCountry] = useState('GB');
  const [busy, setBusy] = useState(false);

  const selectedClient = useMemo(
    () =>
      props.clientImportOptions.find(
        (option) => option.clientId === selectedClientId,
      ) ?? null,
    [props.clientImportOptions, selectedClientId],
  );

  useEffect(() => {
    if (mode !== 'import' || !selectedClient) return;
    setName(selectedClient.suggestedName);
    setDomain(selectedClient.domain ?? '');
    setTargetCountry(selectedClient.targetCountry);
  }, [mode, selectedClient]);

  useEffect(() => {
    if (!props.defaultClientId) return;
    setMode('import');
    setSelectedClientId(props.defaultClientId);
  }, [props.defaultClientId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !domain.trim()) {
      toast.error('Name and domain are required');
      return;
    }

    setBusy(true);
    try {
      await createRanklyProject({
        accountId: props.accountId,
        name: name.trim(),
        domain: domain.trim(),
        target_country: targetCountry.trim().toUpperCase() || 'GB',
        target_language: 'en',
        track_desktop: true,
        track_mobile: true,
        clientId:
          mode === 'import' && selectedClientId ? selectedClientId : null,
      });
      toast.success('Project created');
      setName('');
      setDomain('');
      setSelectedClientId('');
      props.onCreated?.();
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const hasClients = props.clientImportOptions.length > 0;

  return (
    <form
      onSubmit={submit}
      className="max-w-lg space-y-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            mode === 'manual'
              ? 'bg-primary text-primary-foreground'
              : 'bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)]'
          }`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode('import')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            mode === 'import'
              ? 'bg-primary text-primary-foreground'
              : 'bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)]'
          }`}
        >
          Import from client
        </button>
      </div>

      {mode === 'import' ? (
        <div className="space-y-2">
          <Label htmlFor="rankly-import-client">Client / business</Label>
          {hasClients ? (
            <>
              <select
                id="rankly-import-client"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 text-sm"
              >
                <option value="">Select a client…</option>
                {props.clientImportOptions.map((option) => (
                  <option key={option.clientId} value={option.clientId}>
                    {option.label}
                    {option.domain ? ` · ${option.domain}` : ''}
                    {option.hasExistingProject ? ' · has project' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Pulls name and country from the client record. Domain comes from
                a linked website when available.
              </p>
              {selectedClient && !selectedClient.domain ? (
                <p className="text-xs text-amber-400/90">
                  No website domain linked to this client — add one under
                  Websites or enter the domain below.
                </p>
              ) : null}
              {selectedClient?.hasExistingProject ? (
                <p className="text-xs text-amber-400/90">
                  This client already has a Rankly project — you can still add
                  another domain if needed.
                </p>
              ) : null}
            </>
          ) : (
            <div className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-3 text-sm text-[var(--workspace-shell-text-muted)]">
              No clients found in this workspace.
              {props.clientsHref ? (
                <>
                  {' '}
                  <Link
                    href={props.clientsHref}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Add a client
                  </Link>{' '}
                  first, or use Manual for your own business site.
                </>
              ) : (
                ' Add clients under Clients, or use Manual for your own business site.'
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Create a project for your own business or any domain without linking a
          client.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="rankly-project-name">Project name</Label>
        <Input
          id="rankly-project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme SEO"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rankly-project-domain">Domain</Label>
        <Input
          id="rankly-project-domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rankly-project-country">Target country</Label>
        <Input
          id="rankly-project-country"
          value={targetCountry}
          onChange={(e) => setTargetCountry(e.target.value.toUpperCase())}
          placeholder="GB"
          maxLength={8}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create project'}
        </Button>
        {props.onCancel ? (
          <Button type="button" variant="secondary" onClick={props.onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
