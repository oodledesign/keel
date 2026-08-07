'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { Loader2, Plus } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  PIPELINE_WORKSPACE_BUSINESS_PREFIX,
  pickDefaultPipelineTargetId,
} from '~/home/(user)/_lib/pipeline-constants';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { ClientCombobox } from '~/home/[account]/projects/_components/client-combobox';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { PipelineDeal } from '../../_lib/server/pipeline.loader';
import { createDeal } from '../actions';

type ClientOption = { id: string; display_name: string | null };

const WORK_STAGES = [
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
  stages?: ReadonlyArray<{ key: string; label: string }>;
  defaultStage?: string;
  listings?: Array<{ id: string; name: string }>;
  commercial?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When false, only the dialog is rendered (parent owns the open trigger). */
  showTrigger?: boolean;
};

const NONE_LISTING = '__none__';

export function AddDealDialog({
  businesses,
  onDealCreated,
  accountSlug,
  accountId,
  stages = WORK_STAGES,
  defaultStage,
  listings = [],
  commercial = false,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const workspaceScoped = Boolean(accountSlug?.trim());
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [stage, setStage] = useState(defaultStage ?? stages[0]?.key ?? 'lead');
  const [businessId, setBusinessId] = useState(() =>
    pickDefaultPipelineTargetId(businesses, { workspaceScoped }),
  );
  const [mode, setMode] = useState<Mode>('lead');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [listingId, setListingId] = useState(NONE_LISTING);

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
    if (!open || !resolvedAccountId) {
      if (!open) {
        setClients([]);
        setClientsError(null);
      }
      return;
    }

    let cancelled = false;
    setClientsLoading(true);
    setClientsError(null);

    listClients({ accountId: resolvedAccountId, page: 1, pageSize: 100 })
      .then((r: unknown) => {
        if (cancelled) return;
        const raw = r as { data?: unknown } | unknown[];
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setClients((list || []) as ClientOption[]);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setClients([]);
        setClientsError(
          err instanceof Error ? err.message : 'Could not load clients',
        );
      })
      .finally(() => {
        if (!cancelled) setClientsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, resolvedAccountId]);

  const showAssignField = !workspaceScoped && businesses.length > 1;
  const canLinkClient = Boolean(resolvedAccountId);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const formString = (name: string) => String(form.get(name) ?? '').trim();

    const valueStr = formString('value');
    const nextAction = formString('nextAction');
    const nextActionDate = formString('nextActionDate');

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
      contactName = formString('contactName');
      companyName = formString('companyName');
      if (!contactName) {
        setError('Contact name is required');
        return;
      }
    }

    const projectName = mode === 'client' ? formString('projectName') : '';
    const description = mode === 'client' ? formString('description') : '';

    const resolvedBusinessId =
      businessId ||
      pickDefaultPipelineTargetId(businesses, { workspaceScoped });

    if (!resolvedBusinessId) {
      setError(
        workspaceScoped
          ? 'No workspace available for this pipeline.'
          : 'Join or create a workspace before adding to the pipeline.',
      );
      return;
    }

    const value = valueStr ? Math.round(parseFloat(valueStr)) : 0;
    const commercialListingId =
      commercial && listingId !== NONE_LISTING ? listingId : null;

    startTransition(async () => {
      const result = await createDeal({
        contactName,
        companyName: projectName || companyName,
        value,
        stage,
        nextAction: nextAction || undefined,
        nextActionDate: nextActionDate || undefined,
        businessId: resolvedBusinessId,
        clientId: linkedClientId,
        projectName: projectName || null,
        description: description || null,
        accountSlug: accountSlug ?? null,
        commercialListingId,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to create pipeline item');
        return;
      }

      const biz = businesses.find((b) => b.id === resolvedBusinessId);
      onDealCreated({
        id: result.id!,
        contactName,
        companyName: projectName || companyName,
        projectName: projectName || null,
        description: description || null,
        value,
        stage,
        nextAction,
        nextActionDate: nextActionDate || null,
        businessId: resolvedBusinessId,
        businessName: biz?.name ?? '',
        businessColor: biz?.color ?? null,
        clientId: linkedClientId,
        clientName: linkedClientName,
        commercialListingId,
        hotsRentPsf: null,
        hotsSizeSqft: null,
        hotsLeaseYears: null,
        hotsIncentives: null,
        hotsSolicitorName: null,
        hotsTargetExchangeDate: null,
        hotsNotes: null,
        completedAt: null,
      });

      setOpen(false);
      setStage(defaultStage ?? stages[0]?.key ?? 'lead');
      setMode('lead');
      setClientId('');
      setListingId(NONE_LISTING);
      setBusinessId(
        pickDefaultPipelineTargetId(businesses, { workspaceScoped }),
      );
      formRef.current?.reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <button type="button" className={workspaceBtnPrimaryMd}>
            <Plus className="h-4 w-4" />
            {commercial ? 'Add instruction' : 'Add to pipeline'}
          </button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {commercial ? 'Add instruction' : 'Add to pipeline'}
          </DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {commercial
              ? 'Track a new deal and optionally link it to a disposal.'
              : 'Track a new lead or an opportunity for an existing client.'}
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
            <>
              <div className="space-y-2">
                <Label className="text-[var(--workspace-shell-text-muted)]">
                  Client *
                </Label>
                <ClientCombobox
                  clients={clients}
                  value={clientId}
                  onValueChange={setClientId}
                  loading={clientsLoading}
                  placeholder="Select an existing client"
                  emptyMessage={
                    clientsError ? clientsError : 'No clients found.'
                  }
                  addClientHref={
                    accountSlug
                      ? `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}?create=client`
                      : undefined
                  }
                />
              </div>
              {!commercial ? (
                <>
                  <div className="space-y-2">
                    <Label
                      htmlFor="projectName"
                      className="text-[var(--workspace-shell-text-muted)]"
                    >
                      Project name
                    </Label>
                    <Input
                      id="projectName"
                      name="projectName"
                      placeholder="Website redesign"
                      className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                    />
                    <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                      Optional — used when this opportunity is marked Won.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="description"
                      className="text-[var(--workspace-shell-text-muted)]"
                    >
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      rows={3}
                      placeholder="Brief for the new project…"
                      className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                    />
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="contactName"
                  className="text-[var(--workspace-shell-text-muted)]"
                >
                  Contact name *
                </Label>
                <Input
                  id="contactName"
                  name="contactName"
                  placeholder="Full name"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="companyName"
                  className="text-[var(--workspace-shell-text-muted)]"
                >
                  Company
                </Label>
                <Input
                  id="companyName"
                  name="companyName"
                  placeholder="Acme Ltd"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                />
              </div>
            </div>
          )}

          {commercial && listings.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Disposal
              </Label>
              <Select value={listingId} onValueChange={setListingId}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]">
                  <SelectValue placeholder="Link a disposal (optional)" />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  <SelectItem value={NONE_LISTING}>None</SelectItem>
                  {listings.map((listing) => (
                    <SelectItem key={listing.id} value={listing.id}>
                      {listing.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div
            className={`grid gap-4 ${showAssignField ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            {showAssignField ? (
              <div className="space-y-2">
                <Label className="text-[var(--workspace-shell-text-muted)]">
                  Workspace *
                </Label>
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
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Stage
              </Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  {stages.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="value"
              className="text-[var(--workspace-shell-text-muted)]"
            >
              Value (£)
            </Label>
            <Input
              id="value"
              name="value"
              type="number"
              min="0"
              step="1"
              placeholder="5000"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="nextAction"
                className="text-[var(--workspace-shell-text-muted)]"
              >
                Short description / next action
              </Label>
              <Input
                id="nextAction"
                name="nextAction"
                placeholder="Short description"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="nextActionDate"
                className="text-[var(--workspace-shell-text-muted)]"
              >
                Action date
              </Label>
              <Input
                id="nextActionDate"
                name="nextActionDate"
                type="date"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
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
