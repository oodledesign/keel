'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import { Loader2 } from 'lucide-react';

import {
  PIPELINE_WORKSPACE_BUSINESS_PREFIX,
  pickDefaultPipelineTargetId,
} from '~/home/(user)/_lib/pipeline-constants';
import { ClientCombobox } from '~/home/[account]/projects/_components/client-combobox';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { updateDeal } from '../actions';
import type { PipelineDeal } from '../../_lib/server/pipeline.loader';
import { MeetingTranscriptsBlock } from '~/home/[account]/_components/meeting-transcripts-block';

type ClientOption = { id: string; display_name: string | null };

const STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'call_booked', label: 'Call Booked' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

type Mode = 'lead' | 'client';

type Props = {
  deal: PipelineDeal | null;
  businesses: Array<{ id: string; name: string; color: string | null }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDealUpdated: (deal: PipelineDeal) => void;
  accountSlug?: string;
  accountId?: string;
};

export function EditDealDialog({
  deal,
  businesses,
  open,
  onOpenChange,
  onDealUpdated,
  accountSlug,
  accountId,
}: Props) {
  const workspaceScoped = Boolean(accountSlug?.trim());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [stage, setStage] = useState(deal?.stage ?? 'lead');
  const [businessId, setBusinessId] = useState(
    deal?.businessId ?? pickDefaultPipelineTargetId(businesses, { workspaceScoped }),
  );
  const [mode, setMode] = useState<Mode>(deal?.clientId ? 'client' : 'lead');
  const [clientId, setClientId] = useState(deal?.clientId ?? '');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const showAssignField = !workspaceScoped && businesses.length > 1;

  const resolvedAccountId = useMemo(() => {
    if (accountId?.trim()) return accountId.trim();
    if (businessId?.startsWith(PIPELINE_WORKSPACE_BUSINESS_PREFIX)) {
      return businessId.slice(PIPELINE_WORKSPACE_BUSINESS_PREFIX.length);
    }
    return null;
  }, [accountId, businessId]);

  const canLinkClient = Boolean(resolvedAccountId);

  useEffect(() => {
    if (deal && open) {
      setStage(deal.stage);
      setBusinessId(
        (deal.businessId ||
          pickDefaultPipelineTargetId(businesses, { workspaceScoped })) ?? '',
      );
      setMode(deal.clientId ? 'client' : 'lead');
      setClientId(deal.clientId ?? '');
      setError(null);
    }
  }, [deal, open, businesses, workspaceScoped]);

  useEffect(() => {
    if (!open || mode !== 'client' || !resolvedAccountId) return;
    setClientsLoading(true);
    listClients({ accountId: resolvedAccountId, page: 1, pageSize: 100 })
      .then((r: unknown) => {
        const raw = r as { data?: unknown } | unknown[];
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setClients((list || []) as ClientOption[]);
      })
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, [open, mode, resolvedAccountId]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deal) return;
    setError(null);
    const form = new FormData(e.currentTarget);

    const valueStr = (form.get('value') as string).trim();
    const nextAction = (form.get('nextAction') as string).trim();
    const nextActionDate = (form.get('nextActionDate') as string).trim();

    let contactName = '';
    let companyName = '';
    let linkedClientId: string | null = null;
    let linkedClientName: string | null = null;

    if (mode === 'client') {
      const selected = clients.find((c) => c.id === clientId);
      if (!selected) {
        setError('Select a client for this opportunity');
        return;
      }
      linkedClientId = selected.id;
      linkedClientName = selected.display_name ?? 'Client';
      contactName = linkedClientName;
      companyName = '';
    } else {
      contactName = (form.get('contactName') as string).trim();
      companyName = (form.get('companyName') as string).trim();
      if (!contactName) {
        setError('Contact name is required');
        return;
      }
    }

    const resolvedBusinessId =
      businessId || pickDefaultPipelineTargetId(businesses, { workspaceScoped });

    if (!resolvedBusinessId) {
      setError('Please select a workspace');
      return;
    }

    const value = valueStr ? Math.round(parseFloat(valueStr)) : 0;

    startTransition(async () => {
      const result = await updateDeal(deal.id, {
        contactName,
        companyName,
        value,
        stage,
        nextAction: nextAction || undefined,
        nextActionDate: nextActionDate || undefined,
        businessId: resolvedBusinessId,
        clientId: linkedClientId,
        accountSlug: accountSlug ?? null,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to update pipeline item');
        return;
      }

      const biz = businesses.find((b) => b.id === resolvedBusinessId);
      onDealUpdated({
        ...deal,
        contactName,
        companyName,
        value,
        stage,
        nextAction,
        nextActionDate: nextActionDate || null,
        businessId: resolvedBusinessId,
        businessName: biz?.name ?? '',
        businessColor: biz?.color ?? null,
        clientId: linkedClientId,
        clientName: linkedClientName,
      });

      onOpenChange(false);
    });
  }

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit pipeline item</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Update the client or contact, value, stage, and next action.
          </DialogDescription>
        </DialogHeader>

        {canLinkClient ? (
          <div className="flex rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode('lead')}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors',
                mode === 'lead'
                  ? 'bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] shadow-sm'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
              )}
            >
              New lead
            </button>
            <button
              type="button"
              onClick={() => setMode('client')}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors',
                mode === 'client'
                  ? 'bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] shadow-sm'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
              )}
            >
              Existing client
            </button>
          </div>
        ) : null}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {mode === 'client' ? (
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">Client *</Label>
              <ClientCombobox
                clients={clients}
                value={clientId}
                onValueChange={setClientId}
                loading={clientsLoading}
                placeholder="Select an existing client"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-contactName" className="text-[var(--workspace-shell-text-muted)]">
                  Contact name *
                </Label>
                <Input
                  id="edit-contactName"
                  name="contactName"
                  defaultValue={deal.contactName}
                  placeholder="Jane Smith"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-companyName" className="text-[var(--workspace-shell-text-muted)]">
                  Company
                </Label>
                <Input
                  id="edit-companyName"
                  name="companyName"
                  defaultValue={deal.companyName}
                  placeholder="Acme Ltd"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                />
              </div>
            </div>
          )}

          <div className={`grid gap-4 ${showAssignField ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {showAssignField ? (
              <div className="space-y-2">
                <Label className="text-[var(--workspace-shell-text-muted)]">Workspace *</Label>
                <Select value={businessId} onValueChange={setBusinessId}>
                  <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]">
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                    {businesses.map((biz) => (
                      <SelectItem key={biz.id} value={biz.id}>
                        <span className="flex items-center gap-2">
                          {biz.color ? (
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: biz.color }}
                            />
                          ) : null}
                          {biz.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-value" className="text-[var(--workspace-shell-text-muted)]">
              Value (£)
            </Label>
            <Input
              id="edit-value"
              name="value"
              type="number"
              min="0"
              step="1"
              defaultValue={deal.value}
              placeholder="5000"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nextAction" className="text-[var(--workspace-shell-text-muted)]">
                Short description / next action
              </Label>
              <Input
                id="edit-nextAction"
                name="nextAction"
                defaultValue={deal.nextAction}
                placeholder="Short description"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nextActionDate" className="text-[var(--workspace-shell-text-muted)]">
                Action date
              </Label>
              <Input
                id="edit-nextActionDate"
                name="nextActionDate"
                type="date"
                defaultValue={deal.nextActionDate ?? ''}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
              />
            </div>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-xl border border-[color:var(--workspace-shell-border)] px-4 text-sm font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={workspaceBtnPrimaryMd}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </DialogFooter>
        </form>

        {accountId && deal ? (
          <div className="mt-4 border-t border-[color:var(--workspace-shell-border)] pt-4">
            <MeetingTranscriptsBlock
              accountId={accountId}
              accountSlug={accountSlug ?? ''}
              dealId={deal.id}
              canEdit
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
