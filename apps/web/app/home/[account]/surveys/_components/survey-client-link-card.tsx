'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, Pencil } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import {
  ClientCombobox,
  type ClientOption,
} from '~/home/[account]/jobs/_components/client-combobox';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { updateProposal } from '~/home/[account]/proposals/_lib/server/server-actions';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { SurveyDealOption } from '../_lib/server/survey-deal-options.loader';

function toClientOptions(result: unknown): ClientOption[] {
  const raw = result as { data?: unknown } | unknown[];
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown })?.data)
      ? (raw as { data: unknown[] }).data
      : [];
  return (list ?? []) as ClientOption[];
}

function dealLabel(deal: {
  contactName?: string | null;
  companyName?: string | null;
}) {
  const contact = deal.contactName?.trim();
  const company = deal.companyName?.trim();
  if (contact && company) return `${contact} · ${company}`;
  return contact || company || 'Pipeline item';
}

export function SurveyClientLinkCard({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  clientId,
  clientName,
  deal,
  deals,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  clientId: string | null;
  clientName: string | null;
  deal: {
    id: string;
    contact_name?: string | null;
    company_name?: string | null;
    stage?: string | null;
  } | null;
  deals: SurveyDealOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nextClientId, setNextClientId] = useState(clientId ?? '');
  const [nextDealId, setNextDealId] = useState(deal?.id ?? '');
  const [clients, setClients] = useState<ClientOption[] | null>(null);
  const [clientsLoading, setClientsLoading] = useState(false);
  const clientsRequested = useRef(false);

  useEffect(() => {
    if (!editing || clientsRequested.current) return;
    clientsRequested.current = true;
    setClientsLoading(true);
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((result) => setClients(toClientOptions(result)))
      .catch(() => {
        clientsRequested.current = false;
        setClients([]);
      })
      .finally(() => setClientsLoading(false));
  }, [accountId, editing]);

  const dealOptions =
    deal && !deals.some((item) => item.id === deal.id)
      ? [
          {
            id: deal.id,
            contactName: deal.contact_name ?? '',
            companyName: deal.company_name ?? '',
            value: 0,
          },
          ...deals,
        ]
      : deals;

  const startEditing = () => {
    setNextClientId(clientId ?? '');
    setNextDealId(deal?.id ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProposal({
        accountId,
        proposalId,
        client_id: nextClientId || null,
        deal_id: nextDealId || null,
      });
      toast.success('Client details saved');
      setEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const stage = deal?.stage?.replaceAll('_', ' ') || null;

  return (
    <Card className={workspacePanelCard} data-test="survey-client-card">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Client and enquiry
          </h3>
          {canEdit && !editing ? (
            <button
              type="button"
              className={`inline-flex items-center gap-1 text-xs ${workspaceTextMuted} transition-colors hover:text-[var(--workspace-shell-text)]`}
              onClick={startEditing}
              data-test="survey-client-edit"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          ) : null}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label className={`text-xs ${workspaceTextMuted}`}>Client</Label>
              <ClientCombobox
                clients={clients ?? []}
                value={nextClientId}
                onValueChange={setNextClientId}
                loading={clientsLoading}
                placeholder="No client"
                emptyMessage="No clients"
                addClientHref={pathsConfig.app.accountClients.replace(
                  '[account]',
                  accountSlug,
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="survey-client-deal"
                className={`text-xs ${workspaceTextMuted}`}
              >
                Pipeline item
              </Label>
              <select
                id="survey-client-deal"
                value={nextDealId}
                onChange={(event) => setNextDealId(event.target.value)}
                className="w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm text-[var(--workspace-shell-text)]"
              >
                <option value="">None</option>
                {dealOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {dealLabel(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <button
                type="button"
                className={workspaceBtnPrimaryMd}
                disabled={saving}
                onClick={() => void handleSave()}
                data-test="survey-client-save"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        ) : (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className={`text-xs ${workspaceTextMuted}`}>Client</dt>
              <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
                {clientName ?? 'No client linked'}
              </dd>
            </div>
            <div>
              <dt className={`text-xs ${workspaceTextMuted}`}>Pipeline item</dt>
              <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
                {deal ? (
                  <>
                    {dealLabel({
                      contactName: deal.contact_name,
                      companyName: deal.company_name,
                    })}
                    {stage ? (
                      <span className={`capitalize ${workspaceTextMuted}`}>
                        {' '}
                        · {stage}
                      </span>
                    ) : null}
                  </>
                ) : (
                  'Not linked to the pipeline'
                )}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
