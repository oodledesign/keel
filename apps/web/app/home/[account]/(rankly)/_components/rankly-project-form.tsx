'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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
  defaultClientId?: string;
  defaultOpen?: boolean;
  onCreated?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<CreateMode>(
    props.defaultClientId || props.clientImportOptions.length ? 'import' : 'manual',
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
        clientId: mode === 'import' && selectedClientId ? selectedClientId : null,
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

  const hasImportOptions = props.clientImportOptions.length > 0;

  return (
    <form
      onSubmit={submit}
      className="max-w-lg space-y-4 rounded-lg border border-white/10 bg-black/10 p-4"
    >
      {hasImportOptions ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              mode === 'manual'
                ? 'bg-primary text-primary-foreground'
                : 'bg-black/30 text-muted-foreground'
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
                : 'bg-black/30 text-muted-foreground'
            }`}
          >
            Import from client
          </button>
        </div>
      ) : null}

      {mode === 'import' && hasImportOptions ? (
        <div className="space-y-2">
          <Label htmlFor="rankly-import-client">Client / business</Label>
          <select
            id="rankly-import-client"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm"
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
          <p className="text-muted-foreground text-xs">
            Pulls name and country from the client record. Domain comes from a
            linked website when available.
          </p>
          {selectedClient?.hasExistingProject ? (
            <p className="text-xs text-amber-400/90">
              This client already has a Rankly project — you can still add
              another domain if needed.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
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
