'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
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

import { Plus, Loader2 } from 'lucide-react';

import {
  PIPELINE_WORKSPACE_BUSINESS_PREFIX,
  pickDefaultPipelineTargetId,
} from '~/home/(user)/_lib/pipeline-constants';
import { ClientCombobox } from '~/home/[account]/projects/_components/client-combobox';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { createDeal } from '../actions';
import type { PipelineDeal } from '../../_lib/server/pipeline.loader';

type ClientOption = { id: string; display_name: string | null };

const STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'call_booked', label: 'Call Booked' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'negotiation', label: 'Negotiation' },
];

type Mode = 'lead' | 'client';

type Props = {
  businesses: Array<{ id: string; name: string; color: string | null }>;
  onDealCreated: (deal: PipelineDeal) => void;
  accountSlug?: string;
  /** Workspace-scoped board passes its account id so existing clients can be linked. */
  accountId?: string;
};

export function AddDealDialog({
  businesses,
  onDealCreated,
  accountSlug,
  accountId,
}: Props) {
  const workspaceScoped = Boolean(accountSlug?.trim());
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [stage, setStage] = useState('lead');
  const [businessId, setBusinessId] = useState(() =>
    pickDefaultPipelineTargetId(businesses, { workspaceScoped }),
  );
  const [mode, setMode] = useState<Mode>('lead');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  // Resolve the account this deal belongs to: explicit (workspace board) or
  // derived from the selected workspace target on the personal board.
  const resolvedAccountId = useMemo(() => {
    if (accountId?.trim()) return accountId.trim();
    if (businessId?.startsWith(PIPELINE_WORKSPACE_BUSINESS_PREFIX)) {
      return businessId.slice(PIPELINE_WORKSPACE_BUSINESS_PREFIX.length);
    }
    return null;
  }, [accountId, businessId]);

  useEffect(() => {
    if (!open) return;
    setBusinessId(pickDefaultPipelineTargetId(businesses, { workspaceScoped }));
  }, [open, businesses, workspaceScoped]);

  // Existing-client linking only makes sense when we know the workspace.
  useEffect(() => {
    if (!resolvedAccountId && mode === 'client') {
      setMode('lead');
    }
  }, [resolvedAccountId, mode]);

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

  const showAssignField = !workspaceScoped && businesses.length > 1;
  const canLinkClient = Boolean(resolvedAccountId);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      setError(
        workspaceScoped
          ? 'No workspace available for this pipeline.'
          : 'Join or create a workspace before adding to the pipeline.',
      );
      return;
    }

    const value = valueStr ? Math.round(parseFloat(valueStr)) : 0;

    startTransition(async () => {
      const result = await createDeal({
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
        setError(result.error ?? 'Failed to create pipeline item');
        return;
      }

      const biz = businesses.find((b) => b.id === resolvedBusinessId);
      onDealCreated({
        id: result.id!,
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

      setOpen(false);
      setStage('lead');
      setMode('lead');
      setClientId('');
      setBusinessId(pickDefaultPipelineTargetId(businesses, { workspaceScoped }));
      formRef.current?.reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={workspaceBtnPrimaryMd}>
          <Plus className="h-4 w-4" />
          Add to pipeline
        </button>
      </DialogTrigger>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[#0F1923] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to pipeline</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Track a new lead or an opportunity for an existing client.
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
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
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
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
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
                <Label htmlFor="contactName" className="text-[var(--workspace-shell-text-muted)]">
                  Contact name *
                </Label>
                <Input
                  id="contactName"
                  name="contactName"
                  placeholder="Jane Smith"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-[var(--workspace-shell-text-muted)]">
                  Company
                </Label>
                <Input
                  id="companyName"
                  name="companyName"
                  placeholder="Acme Ltd"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                />
              </div>
            </div>
          )}

          <div className={`grid gap-4 ${showAssignField ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {showAssignField ? (
              <div className="space-y-2">
                <Label className="text-[var(--workspace-shell-text-muted)]">Workspace *</Label>
                <Select value={businessId} onValueChange={setBusinessId}>
                  <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[#1A2535] text-[var(--workspace-shell-text)]">
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
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[#1A2535] text-[var(--workspace-shell-text)]">
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
            <Label htmlFor="value" className="text-[var(--workspace-shell-text-muted)]">
              Value (£)
            </Label>
            <Input
              id="value"
              name="value"
              type="number"
              min="0"
              step="1"
              placeholder="5000"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nextAction" className="text-[var(--workspace-shell-text-muted)]">
                Short description / next action
              </Label>
              <Input
                id="nextAction"
                name="nextAction"
                placeholder="Short description"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextActionDate" className="text-[var(--workspace-shell-text-muted)]">
                Action date
              </Label>
              <Input
                id="nextActionDate"
                name="nextActionDate"
                type="date"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
              />
            </div>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
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
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
