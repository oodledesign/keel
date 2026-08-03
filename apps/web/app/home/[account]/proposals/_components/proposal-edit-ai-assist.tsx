'use client';

import { useCallback, useEffect, useState } from 'react';

import { ChevronDown, FileText, Loader2, Sparkles, Wand2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';
import {
  listNotesAndFilesForContextAction,
  loadNotesAndFilesContentAction,
} from '~/home/[account]/_lib/workspace-content/notes-files-actions';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { ClientCombobox } from '~/home/[account]/jobs/_components/client-combobox';
import { listMeetingTranscripts } from '~/home/[account]/meeting-transcripts/_lib/server/server-actions';

import { getErrorMessage } from '../_lib/error-message';
import { getProposal, listProposals } from '../_lib/server/server-actions';
import { ContentTemplatePickerDialog } from '~/components/content-templates/content-template-picker-dialog';

type DealOption = {
  id: string;
  contactName: string;
  companyName: string;
  value: number;
};

type Props = {
  accountSlug: string;
  accountId: string;
  accountName: string;
  senderName: string;
  recipientName: string;
  recipientCompany?: string | null;
  clientId: string | null;
  dealId: string | null;
  dealValue?: number | null;
  contentHtml: string;
  deals: DealOption[];
  disabled?: boolean;
  onContentApplied: (html: string) => void;
};

const EDIT_PRESETS = [
  {
    id: 'warmer',
    label: 'Warmer tone',
    instruction:
      'Make the tone warmer and more personable while staying professional.',
  },
  {
    id: 'tighter',
    label: 'Tighten',
    instruction:
      'Tighten the copy: shorter sentences, less repetition, keep all key commercial points.',
  },
  {
    id: 'formal',
    label: 'More formal',
    instruction:
      'Make the tone more formal and polished for a corporate client.',
  },
  {
    id: 'brand',
    label: 'Match brand voice',
    instruction:
      'Rewrite to better match the brand voice guidance, without changing facts, pricing, or section structure unless needed for clarity.',
  },
] as const;

export function ProposalEditAiAssist({
  accountSlug,
  accountId,
  accountName,
  senderName,
  recipientName,
  recipientCompany,
  clientId,
  dealId,
  dealValue,
  contentHtml,
  deals,
  disabled,
  onContentApplied,
}: Props) {
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');

  const [aiMode, setAiMode] = useState<'client' | 'deal'>(
    dealId ? 'deal' : 'client',
  );
  const [aiClientId, setAiClientId] = useState(clientId ?? '');
  const [aiDealId, setAiDealId] = useState(dealId ?? '');
  const [clientOptions, setClientOptions] = useState<
    { id: string; display_name: string | null }[]
  >([]);
  const [loadingData, setLoadingData] = useState(false);
  const [transcripts, setTranscripts] = useState<
    Array<{ id: string; title: string; content: string }>
  >([]);
  const [selectedTranscriptIds, setSelectedTranscriptIds] = useState<string[]>(
    [],
  );
  const [notesFiles, setNotesFiles] = useState<
    Array<{
      type: 'note' | 'file';
      id: string;
      title: string;
      categoryLabel: string;
    }>
  >([]);
  const [selectedNotesFileKeys, setSelectedNotesFileKeys] = useState<string[]>(
    [],
  );
  const [referenceProposalId, setReferenceProposalId] = useState('');
  const [referenceProposals, setReferenceProposals] = useState<
    Array<{ id: string; title: string | null }>
  >([]);

  const [editInstruction, setEditInstruction] = useState('');

  const openGenerate = useCallback(async () => {
    setGenerateOpen(true);
    setPreview('');
    setAiMode(dealId ? 'deal' : 'client');
    setAiClientId(clientId ?? '');
    setAiDealId(dealId ?? '');
    setLoadingData(true);
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
      const options = (list ?? []) as {
        id: string;
        display_name: string | null;
      }[];
      setClientOptions(options);
      if (!clientId && options[0]) setAiClientId(options[0].id);
      if (!dealId && deals[0]) setAiDealId(deals[0].id);

      const proposalRows = ((proposalsResult as { data?: unknown })?.data ??
        proposalsResult ??
        []) as Array<{ id: string; title: string | null }>;
      setReferenceProposals(
        proposalRows.map((p) => ({ id: p.id, title: p.title })),
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingData(false);
    }
  }, [accountId, clientId, dealId, deals]);

  useEffect(() => {
    if (!generateOpen) return;
    const selectedClientId = aiMode === 'client' ? aiClientId : undefined;
    const selectedDealId = aiMode === 'deal' ? aiDealId : undefined;
    if (!selectedClientId && !selectedDealId) {
      setTranscripts([]);
      setSelectedTranscriptIds([]);
      setNotesFiles([]);
      setSelectedNotesFileKeys([]);
      return;
    }

    let cancelled = false;
    void Promise.all([
      listMeetingTranscripts({
        accountId,
        clientId: selectedClientId,
        dealId: selectedDealId,
      }),
      listNotesAndFilesForContextAction({
        accountId,
        clientId: selectedClientId,
        dealId: selectedDealId,
      }),
    ])
      .then(([transcriptRows, notesFilesResult]) => {
        if (cancelled) return;
        const mapped = (transcriptRows ?? []).map(
          (row: { id: string; title: string; content: string }) => ({
            id: row.id,
            title: row.title,
            content: row.content,
          }),
        );
        setTranscripts(mapped);
        setSelectedTranscriptIds(mapped.map((t) => t.id));
        const items = notesFilesResult.items ?? [];
        setNotesFiles(items);
        setSelectedNotesFileKeys(
          items.map((item) => `${item.type}:${item.id}`),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setTranscripts([]);
          setSelectedTranscriptIds([]);
          setNotesFiles([]);
          setSelectedNotesFileKeys([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, aiClientId, aiDealId, aiMode, generateOpen]);

  const handleGenerate = async () => {
    const selectedClientId = aiMode === 'client' ? aiClientId : undefined;
    const selectedDealId = aiMode === 'deal' ? aiDealId : undefined;
    if (!selectedClientId && !selectedDealId) {
      toast.error('Select a client or lead');
      return;
    }
    if (
      selectedTranscriptIds.length === 0 &&
      selectedNotesFileKeys.length === 0
    ) {
      toast.error('Select at least one transcript or note/file');
      return;
    }

    if (contentHtml.trim()) {
      const ok = window.confirm(
        'Replace the current proposal content with a new AI draft?',
      );
      if (!ok) return;
    }

    const client = clientOptions.find((c) => c.id === selectedClientId);
    const deal = deals.find((d) => d.id === selectedDealId);
    const name =
      recipientName.trim() ||
      client?.display_name?.trim() ||
      deal?.contactName?.trim() ||
      deal?.companyName?.trim() ||
      'Client';
    const company =
      recipientCompany?.trim() || deal?.companyName?.trim() || null;

    setBusy(true);
    setPreview('');
    try {
      let referenceProposalHtml: string | null = null;
      if (referenceProposalId) {
        const ref = await getProposal({
          accountId,
          proposalId: referenceProposalId,
        });
        referenceProposalHtml =
          (ref as { content_html?: string | null })?.content_html ?? null;
      }

      const selectedTranscripts = transcripts
        .filter((t) => selectedTranscriptIds.includes(t.id))
        .map((t) => ({ title: t.title, content: t.content }));

      const selectedRefs = notesFiles
        .filter((item) =>
          selectedNotesFileKeys.includes(`${item.type}:${item.id}`),
        )
        .map((item) => ({ type: item.type, id: item.id, title: item.title }));

      let contextNotes: Array<{
        title: string;
        content: string;
        type: 'note' | 'file';
      }> = [];
      if (selectedRefs.length > 0) {
        const loaded = await loadNotesAndFilesContentAction({
          accountId,
          refs: selectedRefs,
        });
        contextNotes = (loaded.items ?? []).map((item, i) => ({
          title: selectedRefs[i]?.title ?? item.title,
          content: item.content,
          type: item.type,
        }));
      }

      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId,
          recipientName: name,
          recipientCompany: company,
          accountName,
          senderName,
          transcripts: selectedTranscripts,
          contextNotes,
          referenceProposalHtml,
          dealValue: dealValue ?? deal?.value ?? null,
        }),
      });

      // Stream into preview as chunks arrive
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? 'Generation failed');
      }
      if (!response.body) throw new Error('Empty generation stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let html = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        setPreview(html);
      }

      html = html.trim();
      if (!html) throw new Error('AI returned empty proposal content');

      onContentApplied(html);
      setGenerateOpen(false);
      toast.success('AI draft applied — review and save');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (instructionOverride?: string) => {
    const instruction = (instructionOverride ?? editInstruction).trim();
    if (!instruction) {
      toast.error('Add edit instructions');
      return;
    }
    if (!contentHtml.trim()) {
      toast.error('Add or generate proposal content first');
      return;
    }

    setBusy(true);
    setPreview('');
    try {
      const response = await fetch('/api/proposals/edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId,
          contentHtml,
          instruction,
          recipientName: recipientName.trim() || null,
          accountName,
          senderName,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? 'Edit failed');
      }
      if (!response.body) throw new Error('Empty edit stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let html = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        setPreview(html);
      }

      html = html.trim();
      if (!html) throw new Error('AI returned empty proposal content');

      onContentApplied(html);
      setEditOpen(false);
      setEditInstruction('');
      toast.success('AI edits applied — review and save');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || busy}
            className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            AI
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              void openGenerate();
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate with AI
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!contentHtml.trim()}
            onSelect={() => {
              setPreview('');
              setEditOpen(true);
            }}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Edit with AI
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setTemplateOpen(true);
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            Apply template…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ContentTemplatePickerDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        kind="proposal_html"
        accountId={accountId}
        title="Apply proposal template"
        onSelect={(template) => {
          if (contentHtml.trim()) {
            const ok = window.confirm(
              'Replace the current proposal content with this template?',
            );
            if (!ok) return;
          }
          onContentApplied(template.bodyHtml || '');
          toast.success('Template applied — review and save');
        }}
      />

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate proposal with AI</DialogTitle>
          </DialogHeader>
          {loadingData ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Loading…
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                Uses your workspace brand voice when set. Replaces the editor
                content — save when you&apos;re happy.
              </p>

              <div className="inline-flex gap-1 rounded-full border border-[color:var(--workspace-shell-border)] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAiMode('client')}
                  className={`rounded-full px-3 py-1.5 font-medium ${
                    aiMode === 'client'
                      ? 'bg-[var(--ozer-accent)] text-[#09111F]'
                      : 'text-[var(--workspace-shell-text-muted)]'
                  }`}
                >
                  Client
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode('deal')}
                  className={`rounded-full px-3 py-1.5 font-medium ${
                    aiMode === 'deal'
                      ? 'bg-[var(--ozer-accent)] text-[#09111F]'
                      : 'text-[var(--workspace-shell-text-muted)]'
                  }`}
                >
                  Lead
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
                    addClientHref={pathsConfig.app.accountClients.replace(
                      '[account]',
                      accountSlug,
                    )}
                  />
                </div>
              ) : (
                <div>
                  <Label>Lead</Label>
                  <select
                    value={aiDealId}
                    onChange={(e) => setAiDealId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm text-[var(--workspace-shell-text)]"
                  >
                    <option value="">Select lead</option>
                    {deals.map((deal) => (
                      <option key={deal.id} value={deal.id}>
                        {deal.contactName || deal.companyName || 'Lead'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <Label>Transcripts</Label>
                {transcripts.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
                    No transcripts saved yet.
                  </p>
                ) : (
                  <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] p-3">
                    {transcripts.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedTranscriptIds.includes(t.id)}
                          onCheckedChange={(checked) => {
                            setSelectedTranscriptIds((prev) =>
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
                <Label>Notes and files</Label>
                {notesFiles.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
                    No notes or files linked yet.
                  </p>
                ) : (
                  <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] p-3">
                    {notesFiles.map((item) => {
                      const key = `${item.type}:${item.id}`;
                      return (
                        <label
                          key={key}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Checkbox
                            checked={selectedNotesFileKeys.includes(key)}
                            onCheckedChange={(checked) => {
                              setSelectedNotesFileKeys((prev) =>
                                checked
                                  ? [...prev, key]
                                  : prev.filter((k) => k !== key),
                              );
                            }}
                          />
                          <span>
                            {item.type === 'file' ? 'File' : 'Note'} ·{' '}
                            {item.title}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <Label>Reference proposal (optional)</Label>
                <select
                  value={referenceProposalId}
                  onChange={(e) => setReferenceProposalId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm text-[var(--workspace-shell-text)]"
                >
                  <option value="">None</option>
                  {referenceProposals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title?.trim() || 'Untitled proposal'}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                className="w-full bg-[var(--ozer-accent)] text-[#09111F]"
                disabled={busy}
                onClick={() => void handleGenerate()}
              >
                {busy ? 'Generating…' : 'Generate into editor'}
              </Button>

              {preview ? (
                <div className="max-h-48 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3 text-xs text-[var(--workspace-shell-text-muted)]">
                  <p className="mb-2 font-medium text-[var(--workspace-shell-text)]">
                    Preview
                  </p>
                  <pre className="break-words whitespace-pre-wrap">
                    {preview.slice(0, 4000)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit with AI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Rewrite the current draft. Brand voice is applied when configured.
            </p>

            <div className="flex flex-wrap gap-2">
              {EDIT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditInstruction(preset.instruction);
                    void handleEdit(preset.instruction);
                  }}
                  className="rounded-full border border-[color:var(--workspace-shell-border)] px-3 py-1 text-xs font-medium text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div>
              <Label htmlFor="proposal-ai-edit-instruction">Instructions</Label>
              <Textarea
                id="proposal-ai-edit-instruction"
                rows={4}
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                disabled={busy}
                placeholder="e.g. Emphasise the discovery workshop and clarify payment milestones…"
                className="mt-1"
              />
            </div>

            <Button
              className="w-full bg-[var(--ozer-accent)] text-[#09111F]"
              disabled={busy || !editInstruction.trim()}
              onClick={() => void handleEdit()}
            >
              {busy ? 'Editing…' : 'Apply AI edit'}
            </Button>

            {preview ? (
              <div className="max-h-48 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3 text-xs text-[var(--workspace-shell-text-muted)]">
                <p className="mb-2 font-medium text-[var(--workspace-shell-text)]">
                  Preview
                </p>
                <pre className="break-words whitespace-pre-wrap">
                  {preview.slice(0, 4000)}
                </pre>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
