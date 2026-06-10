'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { FileText, PlusCircle, RefreshCw, Search, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { If } from '@kit/ui/if';

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { ClientCombobox } from '~/home/[account]/jobs/_components/client-combobox';
import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';
import { listMeetingTranscripts } from '~/home/[account]/meeting-transcripts/_lib/server/server-actions';

import { getErrorMessage } from '../_lib/error-message';
import {
  createProposal,
  getProposal,
  getProposalTabCountsAction,
  listProposals,
} from '../_lib/server/server-actions';
import { ProposalRowMenu } from './proposal-row-menu';
import { ProposalStatusBadge } from './proposal-status-badge';

type ProposalRow = {
  id: string;
  title: string | null;
  status: string;
  sent_at: string | null;
  expires_at: string | null;
  total_pence: number | null;
  currency: string | null;
  recipient_name: string | null;
  updated_at: string;
  clients: { display_name: string | null } | null;
  pipeline_deals: {
    contact_name: string | null;
    company_name: string | null;
    name: string | null;
  } | null;
};

type DealOption = {
  id: string;
  contactName: string;
  companyName: string;
  value: number;
};

type TabKey = 'unapproved' | 'pending' | 'all';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function recipientLabel(row: ProposalRow) {
  return (
    row.recipient_name?.trim() ||
    row.clients?.display_name?.trim() ||
    row.pipeline_deals?.contact_name?.trim() ||
    row.pipeline_deals?.company_name?.trim() ||
    row.pipeline_deals?.name?.trim() ||
    '—'
  );
}

export function ProposalsPageContent({
  accountSlug,
  accountId,
  accountName,
  senderName,
  canViewProposals,
  canEditProposals,
  deals,
}: {
  accountSlug: string;
  accountId: string;
  accountName: string;
  senderName: string;
  canViewProposals: boolean;
  canEditProposals: boolean;
  canManageProposalStatus: boolean;
  deals: DealOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>('unapproved');
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ unapproved: 0, pending: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'client' | 'deal'>('client');
  const [clientOptions, setClientOptions] = useState<{ id: string; display_name: string | null }[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedDealId, setSelectedDealId] = useState('');

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'client' | 'deal'>('client');
  const [aiClientId, setAiClientId] = useState('');
  const [aiDealId, setAiDealId] = useState('');
  const [aiTranscripts, setAiTranscripts] = useState<Array<{ id: string; title: string; content: string }>>([]);
  const [aiSelectedTranscriptIds, setAiSelectedTranscriptIds] = useState<string[]>([]);
  const [aiReferenceProposals, setAiReferenceProposals] = useState<Array<{ id: string; title: string | null }>>([]);
  const [aiReferenceProposalId, setAiReferenceProposalId] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiLoadingData, setAiLoadingData] = useState(false);
  const [aiStreamPreview, setAiStreamPreview] = useState('');

  const pageSize = 20;

  const fetchCounts = useCallback(async () => {
    try {
      const result = await getProposalTabCountsAction({ accountId });
      setCounts(result as typeof counts);
    } catch {
      /* ignore */
    }
  }, [accountId]);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const statusMap = {
        unapproved: 'unapproved',
        pending: 'pending',
        all: 'all',
      } as const;
      const result = await listProposals({
        accountId,
        page,
        pageSize,
        query: searchDebounced || undefined,
        status: statusMap[tab],
      });
      if (result?.data !== undefined) {
        setProposals((result.data ?? []) as unknown as ProposalRow[]);
        setTotal(result.total ?? 0);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      setProposals([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accountId, page, pageSize, searchDebounced, tab]);

  useEffect(() => {
    void fetchProposals();
    void fetchCounts();
  }, [fetchProposals, fetchCounts]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!accountId) return;
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((result) => {
        const raw = result as { data?: unknown } | unknown[];
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setClientOptions((list ?? []) as { id: string; display_name: string | null }[]);
      })
      .catch(() => setClientOptions([]));
  }, [accountId]);

  const openCreateSheet = useCallback(async () => {
    setCreateSheetOpen(true);
    setCreateMode('client');
    setSelectedClientId('');
    setSelectedDealId('');
    setClientsLoading(true);
    try {
      const result = await listClients({ accountId, page: 1, pageSize: 100 });
      const raw = result as { data?: unknown } | unknown[];
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: unknown })?.data)
          ? (raw as { data: unknown[] }).data
          : [];
      const options = (list ?? []) as { id: string; display_name: string | null }[];
      setClientOptions(options);
      if (options.length > 0) setSelectedClientId(options[0]!.id);
      if (deals.length > 0) setSelectedDealId(deals[0]!.id);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setClientOptions([]);
    } finally {
      setClientsLoading(false);
    }
  }, [accountId, deals]);

  useEffect(() => {
    if (!canEditProposals || searchParams.get('create') !== 'proposal') return;
    void openCreateSheet();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [canEditProposals, openCreateSheet, pathname, router, searchParams]);

  useEffect(() => {
    if (!aiDialogOpen) return;
    const clientId = aiMode === 'client' ? aiClientId : undefined;
    const dealId = aiMode === 'deal' ? aiDealId : undefined;
    if (!clientId && !dealId) {
      setAiTranscripts([]);
      setAiSelectedTranscriptIds([]);
      return;
    }

    let cancelled = false;
    void listMeetingTranscripts({ accountId, clientId, dealId })
      .then((rows) => {
        if (cancelled) return;
        const mapped = (rows ?? []).map((row: { id: string; title: string; content: string }) => ({
          id: row.id,
          title: row.title,
          content: row.content,
        }));
        setAiTranscripts(mapped);
        setAiSelectedTranscriptIds(mapped.map((t: { id: string }) => t.id));
      })
      .catch(() => {
        if (!cancelled) {
          setAiTranscripts([]);
          setAiSelectedTranscriptIds([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, aiClientId, aiDealId, aiDialogOpen, aiMode]);

  const openAiDialog = useCallback(async () => {
    setAiDialogOpen(true);
    setAiMode('client');
    setAiClientId('');
    setAiDealId('');
    setAiSelectedTranscriptIds([]);
    setAiReferenceProposalId('');
    setAiStreamPreview('');
    setAiLoadingData(true);
    try {
      const [clientsResult, proposalsResult] = await Promise.all([
        listClients({ accountId, page: 1, pageSize: 100 }),
        listProposals({ accountId, page: 1, pageSize: 50, status: 'all' }),
      ]);

      const raw = clientsResult as { data?: unknown } | unknown[];
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: unknown })?.data)
          ? (raw as { data: unknown[] }).data
          : [];
      const options = (list ?? []) as { id: string; display_name: string | null }[];
      setClientOptions(options);
      if (options.length > 0) setAiClientId(options[0]!.id);
      if (deals.length > 0) setAiDealId(deals[0]!.id);

      const proposalRows = ((proposalsResult as { data?: unknown })?.data ?? proposalsResult ?? []) as ProposalRow[];
      setAiReferenceProposals(
        proposalRows.map((p) => ({ id: p.id, title: p.title })),
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAiLoadingData(false);
    }
  }, [accountId, deals]);

  const handleCreateProposal = async () => {
    if (!canEditProposals) return;
    const clientId = createMode === 'client' ? selectedClientId : undefined;
    const dealId = createMode === 'deal' ? selectedDealId : undefined;
    if (!clientId && !dealId) {
      toast.error(createMode === 'client' ? 'Please select a client' : 'Please select a deal');
      return;
    }

    const deal = deals.find((d) => d.id === dealId);
    setCreating(true);
    try {
      const proposal = await createProposal({
        accountId,
        client_id: clientId ?? null,
        deal_id: dealId ?? null,
        recipient_name: deal?.contactName || null,
        title: deal ? `Proposal for ${deal.contactName || deal.companyName || 'deal'}` : undefined,
      });
      if (proposal?.id) {
        setCreateSheetOpen(false);
        router.push(
          pathsConfig.app.accountProposalEdit
            .replace('[account]', accountSlug)
            .replace('[id]', proposal.id),
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!canEditProposals) return;
    const clientId = aiMode === 'client' ? aiClientId : undefined;
    const dealId = aiMode === 'deal' ? aiDealId : undefined;
    if (!clientId && !dealId) {
      toast.error('Select a client or deal');
      return;
    }
    if (aiSelectedTranscriptIds.length === 0) {
      toast.error('Select at least one transcript');
      return;
    }

    const client = clientOptions.find((c) => c.id === clientId);
    const deal = deals.find((d) => d.id === dealId);
    const recipientName =
      client?.display_name?.trim() ||
      deal?.contactName?.trim() ||
      deal?.companyName?.trim() ||
      'Client';
    const recipientCompany = deal?.companyName?.trim() || null;

    setAiGenerating(true);
    setAiStreamPreview('');
    try {
      let referenceProposalHtml: string | null = null;
      if (aiReferenceProposalId) {
        const ref = await getProposal({ accountId, proposalId: aiReferenceProposalId });
        referenceProposalHtml = (ref as { content_html?: string | null })?.content_html ?? null;
      }

      const transcripts = aiTranscripts
        .filter((t) => aiSelectedTranscriptIds.includes(t.id))
        .map((t) => ({ title: t.title, content: t.content }));

      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId,
          recipientName,
          recipientCompany,
          accountName,
          senderName,
          transcripts,
          referenceProposalHtml,
          dealValue: deal?.value ?? null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? 'Generation failed');
      }

      if (!response.body) {
        throw new Error('Empty generation stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let contentHtml = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        contentHtml += chunk;
        setAiStreamPreview(contentHtml);
      }

      contentHtml = contentHtml.trim();
      if (!contentHtml) {
        throw new Error('AI returned empty proposal content');
      }

      const proposal = await createProposal({
        accountId,
        client_id: clientId ?? null,
        deal_id: dealId ?? null,
        title: `Proposal for ${recipientName}`,
        content_html: contentHtml,
        recipient_name: recipientName,
        total_pence: deal?.value ? Math.round(deal.value * 100) : null,
      });

      setAiDialogOpen(false);
      if (proposal?.id) {
        router.push(
          pathsConfig.app.accountProposalEdit
            .replace('[account]', accountSlug)
            .replace('[id]', proposal.id),
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAiGenerating(false);
    }
  };

  const editPathBase = pathsConfig.app.accountProposalEdit.replace('[account]', accountSlug);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'unapproved', label: 'Unapproved', count: counts.unapproved },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'all', label: 'All', count: counts.all },
  ];

  if (!canViewProposals) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-zinc-400">You don&apos;t have access to proposals in this account.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 md:px-6">
      <div className="rounded-2xl border border-white/8 bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 p-4">
          <div className="inline-flex flex-wrap gap-1 rounded-full border border-white/8 bg-[var(--workspace-control-surface)]/80 p-1 text-xs">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                  tab === item.key
                    ? 'bg-[var(--keel-teal)] text-[#09111F]'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                {item.label}
                {item.count != null ? ` (${item.count})` : ''}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchProposals()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <If condition={canEditProposals}>
              <Button variant="outline" size="sm" onClick={() => void openAiDialog()}>
                <Sparkles className="mr-2 h-4 w-4" />
                AI generate
              </Button>
              <Button
                size="sm"
                className="bg-[var(--keel-teal)] text-[#09111F] hover:bg-[#6BD48F]"
                onClick={() => void openCreateSheet()}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create proposal
              </Button>
            </If>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-white/8 px-4 py-3">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search title or recipient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {search ? (
            <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
              Clear filters
            </Button>
          ) : null}
        </div>

        <div className="overflow-auto p-4">
          {loading ? (
            <p className="text-zinc-400">Loading…</p>
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-zinc-400">
              <FileText className="mb-3 h-10 w-10 opacity-50" />
              No proposals in this tab.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-zinc-400">
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Recipient</th>
                  <th className="pb-2 pr-4">Sent</th>
                  <th className="pb-2 pr-4">Expires</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {proposals.map((row) => (
                  <tr key={row.id} className="border-t border-white/6 hover:bg-white/3">
                    <td className="py-3 pr-4">
                      <Link
                        href={editPathBase.replace('[id]', row.id)}
                        className="font-medium text-white hover:underline"
                      >
                        {row.title?.trim() || 'Untitled proposal'}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-zinc-300">{recipientLabel(row)}</td>
                    <td className="py-3 pr-4 text-zinc-400">{formatDate(row.sent_at)}</td>
                    <td className="py-3 pr-4 text-zinc-400">{formatDate(row.expires_at)}</td>
                    <td className="py-3 pr-4 text-zinc-300">
                      {row.total_pence != null
                        ? formatPence(row.total_pence, row.currency ?? 'GBP')
                        : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <ProposalStatusBadge status={row.status} />
                    </td>
                    <td className="py-3">
                      <ProposalRowMenu
                        accountId={accountId}
                        accountSlug={accountSlug}
                        proposal={row}
                        canEditProposals={canEditProposals}
                        onChanged={fetchProposals}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && total > 0 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
              <span>
                Page {page} of {totalPages} ({total} proposals)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create proposal</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="inline-flex gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-xs">
              <button
                type="button"
                onClick={() => setCreateMode('client')}
                className={`rounded-full px-3 py-1.5 font-medium ${
                  createMode === 'client' ? 'bg-[var(--keel-teal)] text-[#09111F]' : 'text-zinc-300'
                }`}
              >
                Client
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('deal')}
                className={`rounded-full px-3 py-1.5 font-medium ${
                  createMode === 'deal' ? 'bg-[var(--keel-teal)] text-[#09111F]' : 'text-zinc-300'
                }`}
              >
                Deal
              </button>
            </div>

            {createMode === 'client' ? (
              <div>
                <Label>Client</Label>
                <ClientCombobox
                  clients={clientOptions}
                  value={selectedClientId}
                  onValueChange={setSelectedClientId}
                  loading={clientsLoading}
                  placeholder="Select client"
                  emptyMessage="No clients"
                  addClientHref={pathsConfig.app.accountClients.replace('[account]', accountSlug)}
                />
              </div>
            ) : (
              <div>
                <Label>Deal</Label>
                <select
                  value={selectedDealId}
                  onChange={(e) => setSelectedDealId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm text-white"
                >
                  <option value="">Select deal</option>
                  {deals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.contactName || deal.companyName || 'Deal'} — {formatPence(Math.round(deal.value * 100))}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              className="w-full bg-[var(--keel-teal)] text-[#09111F]"
              onClick={() => void handleCreateProposal()}
              disabled={
                creating ||
                (createMode === 'client' ? !selectedClientId : !selectedDealId)
              }
            >
              {creating ? 'Creating…' : 'Create and edit'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate proposal with AI</DialogTitle>
          </DialogHeader>
          {aiLoadingData ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div className="inline-flex gap-1 rounded-full border p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAiMode('client')}
                  className={`rounded-full px-3 py-1.5 font-medium ${
                    aiMode === 'client' ? 'bg-primary text-primary-foreground' : ''
                  }`}
                >
                  Client
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode('deal')}
                  className={`rounded-full px-3 py-1.5 font-medium ${
                    aiMode === 'deal' ? 'bg-primary text-primary-foreground' : ''
                  }`}
                >
                  Deal
                </button>
              </div>

              {aiMode === 'client' ? (
                <div>
                  <Label>Client</Label>
                  <ClientCombobox
                    clients={clientOptions}
                    value={aiClientId}
                    onValueChange={setAiClientId}
                    loading={false}
                    placeholder="Select client"
                    emptyMessage="No clients"
                    addClientHref={pathsConfig.app.accountClients.replace('[account]', accountSlug)}
                  />
                </div>
              ) : (
                <div>
                  <Label>Deal</Label>
                  <select
                    value={aiDealId}
                    onChange={(e) => setAiDealId(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select deal</option>
                    {deals.map((deal) => (
                      <option key={deal.id} value={deal.id}>
                        {deal.contactName || deal.companyName || 'Deal'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label>Transcripts</Label>
                {aiTranscripts.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No transcripts saved yet.</p>
                ) : (
                  <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                    {aiTranscripts.map((t) => (
                      <label key={t.id} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={aiSelectedTranscriptIds.includes(t.id)}
                          onCheckedChange={(checked) => {
                            setAiSelectedTranscriptIds((prev) =>
                              checked
                                ? [...prev, t.id]
                                : prev.filter((id) => id !== t.id),
                            );
                          }}
                        />
                        <span>{t.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Reference proposal (optional)</Label>
                <select
                  value={aiReferenceProposalId}
                  onChange={(e) => setAiReferenceProposalId(e.target.value)}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {aiReferenceProposals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title?.trim() || 'Untitled proposal'}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                className="w-full bg-[var(--keel-teal)] text-[#09111F]"
                disabled={aiGenerating}
                onClick={() => void handleAiGenerate()}
              >
                {aiGenerating ? 'Generating…' : 'Generate proposal'}
              </Button>

              {aiStreamPreview ? (
                <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="mb-2 font-medium text-foreground">Preview</p>
                  <pre className="whitespace-pre-wrap break-words">{aiStreamPreview.slice(0, 4000)}</pre>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
