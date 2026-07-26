'use client';

import { useEffect, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { ClientSupportLinkCard } from '../../clients/_components/client-support-link-card';
import { ClientWorkspaceSharesCard } from '../../clients/_components/client-workspace-shares-card';
import { listSupportClientOrgs } from '../_lib/server/server-actions';

type ClientOrgOption = { id: string; name: string };

export function SupportClientLinksPanel({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const [clientOrgs, setClientOrgs] = useState<ClientOrgOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  useEffect(() => {
    listSupportClientOrgs({ accountId })
      .then((rows) => {
        const options = (rows ?? []).map((row) => ({
          id: row.id,
          name: row.name,
        }));
        setClientOrgs(options);
        if (options[0] && !selectedOrgId) {
          setSelectedOrgId(options[0].id);
        }
      })
      .catch(() => setClientOrgs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per account
  }, [accountId]);

  if (clientOrgs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-[20px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Client public links
        </h2>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          Copy or rotate the obscure submit link for a client. You can also
          manage this from the client profile.
        </p>
      </div>

      <div className="max-w-md space-y-2">
        <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
          <SelectTrigger>
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clientOrgs.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedOrgId ? (
        <div className="space-y-3">
          <ClientSupportLinkCard
            accountId={accountId}
            clientOrgId={selectedOrgId}
            accountSlug={accountSlug}
            compact
          />
          <ClientWorkspaceSharesCard
            accountId={accountId}
            clientOrgId={selectedOrgId}
            accountSlug={accountSlug}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}
