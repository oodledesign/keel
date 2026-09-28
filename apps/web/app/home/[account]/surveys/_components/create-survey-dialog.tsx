'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { MapPin } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { AddressSearchField } from '~/components/commercial/address-search-field';
import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import {
  ClientCombobox,
  type ClientOption,
} from '~/home/[account]/jobs/_components/client-combobox';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { createProposal } from '~/home/[account]/proposals/_lib/server/server-actions';
import {
  documentDetailPath,
  titleForRecipient,
} from '~/lib/building-surveyor/document-kind';
import {
  HOME_SURVEY_LEVEL_OPTIONS,
  type SurveyLevel,
} from '~/lib/building-surveyor/survey-types';
import type { AddressSuggestion } from '~/lib/commercial/address-suggest.types';
import {
  workspaceBtnPrimaryMd,
  workspaceLinkAccent,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

export type CreateSurveyDealOption = {
  id: string;
  contactName: string;
  companyName: string;
};

function toClientOptions(result: unknown): ClientOption[] {
  const raw = result as { data?: unknown } | unknown[];
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown })?.data)
      ? (raw as { data: unknown[] }).data
      : [];
  return (list ?? []) as ClientOption[];
}

function addressFromSuggestion(suggestion: AddressSuggestion) {
  return (
    [suggestion.addressLine1, suggestion.addressLine2, suggestion.town]
      .filter(Boolean)
      .join(', ') || suggestion.label
  );
}

export function CreateSurveyDialog({
  accountId,
  accountSlug,
  deals,
  open,
  onOpenChange,
  clients: preloadedClients,
}: {
  accountId: string;
  accountSlug: string;
  deals: CreateSurveyDealOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients?: ClientOption[] | null;
}) {
  const router = useRouter();
  const [surveyLevel, setSurveyLevel] = useState<SurveyLevel>(2);
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [uprn, setUprn] = useState('');
  const [manualEntry, setManualEntry] = useState(false);
  const [clientId, setClientId] = useState('');
  const [dealId, setDealId] = useState('');
  const [fetchedClients, setFetchedClients] = useState<ClientOption[] | null>(
    null,
  );
  const [clientsLoading, setClientsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const clientsRequested = useRef(false);

  const clients = preloadedClients ?? fetchedClients ?? [];

  useEffect(() => {
    if (!open) return;
    setSurveyLevel(2);
    setAddress('');
    setPostcode('');
    setUprn('');
    setManualEntry(false);
    setClientId('');
    setDealId('');
  }, [open]);

  useEffect(() => {
    if (!open || preloadedClients || clientsRequested.current) return;
    clientsRequested.current = true;
    setClientsLoading(true);
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((result) => setFetchedClients(toClientOptions(result)))
      .catch(() => {
        clientsRequested.current = false;
        setFetchedClients([]);
      })
      .finally(() => setClientsLoading(false));
  }, [accountId, open, preloadedClients]);

  const canSubmit = Boolean(address.trim() || clientId || dealId) && !creating;

  const handleCreate = async () => {
    if (!canSubmit) {
      toast.error('Add a property address or link a client');
      return;
    }
    const deal = deals.find((item) => item.id === dealId);
    setCreating(true);
    try {
      const proposal = await createProposal({
        accountId,
        client_id: clientId || null,
        deal_id: dealId || null,
        kind: 'survey_report',
        recipient_name: deal?.contactName || null,
        title:
          address.trim() ||
          (deal
            ? titleForRecipient(
                'survey_report',
                deal.contactName || deal.companyName || 'pipeline item',
              )
            : undefined),
        survey_level: surveyLevel,
        survey_property_address: address.trim() || null,
        survey_property_postcode: postcode.trim() || null,
        survey_uprn: uprn.trim() || null,
      });
      if (proposal?.id) {
        onOpenChange(false);
        router.push(
          documentDetailPath(accountSlug, proposal.id, 'survey_report'),
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const hasSelectedAddress = Boolean(address.trim()) && !manualEntry;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        data-test="survey-create-dialog"
      >
        <DialogHeader>
          <DialogTitle>New survey</DialogTitle>
          <DialogDescription>
            Start with the property. You can link a client later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Survey level</Label>
            <div className="flex">
              <div className="inline-flex gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-1 text-xs">
                {HOME_SURVEY_LEVEL_OPTIONS.map((option) => (
                  <button
                    key={option.level}
                    type="button"
                    onClick={() => setSurveyLevel(option.level)}
                    className={`rounded-full px-3 py-1.5 font-medium ${
                      surveyLevel === option.level
                        ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                        : 'text-[var(--workspace-shell-text-muted)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {hasSelectedAddress ? (
            <div className="space-y-2">
              <Label>Property</Label>
              <div className="flex items-start gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2.5 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{address}</p>
                  {postcode ? (
                    <p className={`text-xs ${workspaceTextMuted}`}>
                      {postcode}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`shrink-0 text-xs ${workspaceLinkAccent}`}
                  onClick={() => {
                    setAddress('');
                    setPostcode('');
                  }}
                >
                  Change
                </button>
              </div>
            </div>
          ) : manualEntry ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="survey-create-address">Address</Label>
                <Input
                  id="survey-create-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="12 Example Street, Bath"
                  data-test="survey-create-address"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="survey-create-postcode">Postcode</Label>
                  <Input
                    id="survey-create-postcode"
                    value={postcode}
                    onChange={(event) => setPostcode(event.target.value)}
                    placeholder="BA1 1UA"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="survey-create-uprn">
                    Property reference (UPRN)
                  </Label>
                  <Input
                    id="survey-create-uprn"
                    value={uprn}
                    onChange={(event) => setUprn(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <p className={`text-xs ${workspaceTextMuted}`}>
                The UPRN is the unique number for a property in the national
                address register. Leave it blank if you don&apos;t know it; we
                fill it in when you pull the EPC.
              </p>
              <button
                type="button"
                className={`text-xs ${workspaceLinkAccent}`}
                onClick={() => setManualEntry(false)}
              >
                Search for the address instead
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <AddressSearchField
                label="Property address"
                hint={null}
                autoFocus
                onSelect={(suggestion) => {
                  setAddress(addressFromSuggestion(suggestion));
                  setPostcode(suggestion.postcode ?? '');
                }}
              />
              <button
                type="button"
                className={`text-xs ${workspaceLinkAccent}`}
                onClick={() => setManualEntry(true)}
              >
                Enter address manually
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Client (optional)</Label>
              {clientId ? (
                <button
                  type="button"
                  className={`text-xs ${workspaceLinkAccent}`}
                  onClick={() => setClientId('')}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <ClientCombobox
              clients={clients}
              value={clientId}
              onValueChange={setClientId}
              loading={clientsLoading}
              placeholder="No client"
              emptyMessage="No clients"
              addClientHref={pathsConfig.app.accountClients.replace(
                '[account]',
                accountSlug,
              )}
            />
          </div>

          {deals.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="survey-create-deal">
                Pipeline item (optional)
              </Label>
              <select
                id="survey-create-deal"
                value={dealId}
                onChange={(event) => setDealId(event.target.value)}
                className="w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm text-[var(--workspace-shell-text)]"
              >
                <option value="">None</option>
                {deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.contactName || deal.companyName || 'Pipeline item'}
                    {deal.contactName && deal.companyName
                      ? ` · ${deal.companyName}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={!canSubmit}
              onClick={() => void handleCreate()}
              data-test="survey-create-submit"
            >
              {creating ? 'Creating…' : 'Create survey'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
