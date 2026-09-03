'use client';

import { useCallback, useEffect, useState } from 'react';

import { FileStack, Loader2, Pencil, PlusCircle, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';

import { DocumentRichTextEditor } from '~/components/document-rich-text';

import { getErrorMessage } from '../_lib/error-message';
import type { PaymentPlanItem } from '../_lib/schema/contracts.schema';
import {
  createContractTemplate,
  deleteContractTemplate,
  listContractTemplates,
  updateContractTemplate,
} from '../_lib/server/server-actions';
import { ContractSmartFieldChips } from './contract-smart-field-chips';

export type ContractTemplateRow = {
  id: string;
  name: string;
  content_html: string;
  default_title: string | null;
  default_total_pence: number;
  default_payment_plan: PaymentPlanItem[] | unknown;
  created_at: string;
  updated_at: string;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ContractTemplatesPanel({
  accountId,
  canEditContracts,
  onUseTemplate,
}: {
  accountId: string;
  canEditContracts: boolean;
  onUseTemplate?: (template: ContractTemplateRow) => void;
}) {
  const [templates, setTemplates] = useState<ContractTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [defaultTitle, setDefaultTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listContractTemplates({ accountId });
      setTemplates((result ?? []) as ContractTemplateRow[]);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setDefaultTitle('');
    setContentHtml(
      '<h2>Agreement</h2><p>This agreement is between {{account.name}} and {{client.fullName}} of {{client.company}}.</p><p>The total fee is {{contract.total}}, payable as follows:</p><p>{{contract.paymentPlan}}</p><p>Dated {{contract.date}}.</p>',
    );
    setEditorOpen(true);
  };

  const openEdit = (template: ContractTemplateRow) => {
    setEditingId(template.id);
    setName(template.name);
    setDefaultTitle(template.default_title ?? '');
    setContentHtml(template.content_html ?? '');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateContractTemplate({
          accountId,
          templateId: editingId,
          name: name.trim(),
          default_title: defaultTitle.trim() || null,
          content_html: contentHtml,
        });
        toast.success('Template updated');
      } else {
        await createContractTemplate({
          accountId,
          name: name.trim(),
          default_title: defaultTitle.trim() || null,
          content_html: contentHtml,
          default_total_pence: 0,
          default_payment_plan: [],
        });
        toast.success('Template saved');
      }
      setEditorOpen(false);
      await fetchTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: ContractTemplateRow) => {
    if (!window.confirm(`Delete template “${template.name}”?`)) return;
    try {
      await deleteContractTemplate({
        accountId,
        templateId: template.id,
      });
      toast.success('Template deleted');
      await fetchTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const insertToken = (token: string) => {
    setContentHtml((html) => `${html}${html ? ' ' : ''}${token}`);
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Reusable agreement drafts with smart fields for client, amount, and
          dates.
        </p>
        {canEditContracts ? (
          <Button
            size="sm"
            className="bg-[var(--ozer-accent)] text-[#09111F] hover:bg-[#6BD48F]"
            onClick={openCreate}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            New template
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-[var(--workspace-shell-text-muted)]">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-[var(--workspace-shell-text-muted)]">
          <FileStack className="mb-3 h-10 w-10 opacity-50" />
          No templates yet.
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[var(--workspace-shell-text-muted)]">
              <th className="pr-4 pb-2">Name</th>
              <th className="pr-4 pb-2">Default title</th>
              <th className="pr-4 pb-2">Updated</th>
              <th className="w-40 pb-2" />
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr
                key={template.id}
                className="border-t border-[color:var(--workspace-shell-border)]"
              >
                <td className="py-3 pr-4 font-medium text-[var(--workspace-shell-text)]">
                  {template.name}
                </td>
                <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                  {template.default_title || '—'}
                </td>
                <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                  {formatDate(template.updated_at)}
                </td>
                <td className="py-3">
                  <div className="flex justify-end gap-1">
                    {onUseTemplate ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUseTemplate(template)}
                      >
                        Use
                      </Button>
                    ) : null}
                    {canEditContracts ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit template"
                          onClick={() => openEdit(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete template"
                          onClick={() => void handleDelete(template)}
                        >
                          <Trash2 className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {editingId ? 'Edit template' : 'New template'}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Standard services agreement"
              />
            </div>
            <div>
              <Label>Default contract title</Label>
              <Input
                value={defaultTitle}
                onChange={(e) => setDefaultTitle(e.target.value)}
                placeholder="Services agreement"
              />
            </div>
            <div>
              <Label className="mb-2 block">Body</Label>
              <DocumentRichTextEditor
                value={contentHtml}
                onChange={setContentHtml}
                minHeight={280}
                placeholder="Write reusable agreement terms…"
              />
              <ContractSmartFieldChips onInsert={insertToken} />
            </div>
            <Button
              className="w-full bg-[var(--ozer-accent)] text-[#09111F]"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {saving ? 'Saving…' : 'Save template'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
