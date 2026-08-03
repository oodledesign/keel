'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Copy, Loader2, Plus, Star, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import {
  deleteAccountTemplateAction,
  duplicateSystemToAccountAction,
  setAccountTemplateDefaultAction,
  upsertAccountTemplateAction,
} from '~/lib/content-templates/account.actions';
import type {
  AccountContentTemplate,
  AccountTemplateKind,
  SystemContentTemplate,
} from '~/lib/content-templates/types';

const KIND_LABELS: Record<AccountTemplateKind, string> = {
  proposal_html: 'Proposal content',
  proposal_email: 'Proposal email',
  contract_email: 'Contract email',
  invoice_email: 'Invoice email',
};

type Props = {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  systemTemplates: SystemContentTemplate[];
  accountTemplates: AccountContentTemplate[];
};

export function WorkspaceTemplatesSettingsClient({
  accountId,
  accountSlug,
  canEdit,
  systemTemplates,
  accountTemplates,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<AccountTemplateKind>('proposal_html');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [signature, setSignature] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const customs = useMemo(
    () => accountTemplates.filter((t) => t.kind === kind),
    [accountTemplates, kind],
  );
  const system = useMemo(
    () => systemTemplates.filter((t) => t.kind === kind),
    [systemTemplates, kind],
  );

  const isHtml = kind === 'proposal_html';
  const isEmail =
    kind === 'proposal_email' ||
    kind === 'contract_email' ||
    kind === 'invoice_email';

  function resetForm() {
    setEditingId(null);
    setName('');
    setDescription('');
    setSubject('');
    setBodyHtml('');
    setBodyText('');
    setSignature('');
    setIsDefault(false);
  }

  function loadCustom(template: AccountContentTemplate) {
    setEditingId(template.id);
    setKind(template.kind);
    setName(template.name);
    setDescription(template.description ?? '');
    setSubject(template.subject ?? '');
    setBodyHtml(template.bodyHtml);
    setBodyText(template.bodyText);
    setSignature(template.signature ?? '');
    setIsDefault(template.isDefault);
  }

  function run(label: string, fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
        resetForm();
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Something went wrong',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-[color:var(--workspace-shell-border)] p-1 text-xs">
        {(Object.keys(KIND_LABELS) as AccountTemplateKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              resetForm();
            }}
            className={`rounded-full px-3 py-1.5 font-medium ${
              kind === k
                ? 'bg-[var(--ozer-accent)] text-[#09111F]'
                : 'text-[var(--workspace-shell-text-muted)]'
            }`}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Ozer defaults
        </h2>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Duplicate a system template into your workspace to customise it.
        </p>
        <ul className="mt-3 divide-y divide-[color:var(--workspace-shell-border)]">
          {system.length === 0 ? (
            <li className="py-3 text-sm text-[var(--workspace-shell-text-muted)]">
              No system templates for this type.
            </li>
          ) : (
            system.map((template) => (
              <li
                key={template.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {template.name}
                  </p>
                  {template.description ? (
                    <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                      {template.description}
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run('Duplicated to workspace', () =>
                        duplicateSystemToAccountAction({
                          accountId,
                          accountSlug,
                          systemTemplateId: template.id,
                        }),
                      )
                    }
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Workspace templates
            </h2>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              Your custom presets. Mark one as default for new proposals.
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={resetForm}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New
            </Button>
          ) : null}
        </div>

        <ul className="mt-3 divide-y divide-[color:var(--workspace-shell-border)]">
          {customs.length === 0 ? (
            <li className="py-3 text-sm text-[var(--workspace-shell-text-muted)]">
              No custom templates yet.
            </li>
          ) : (
            customs.map((template) => (
              <li
                key={template.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => canEdit && loadCustom(template)}
                >
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {template.name}
                    {template.isDefault ? (
                      <span className="ml-2 text-[10px] tracking-wide text-[var(--ozer-accent-muted)] uppercase">
                        Default
                      </span>
                    ) : null}
                  </p>
                </button>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    {!template.isDefault ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                        aria-label="Set default"
                        onClick={() =>
                          run('Default updated', () =>
                            setAccountTemplateDefaultAction({
                              id: template.id,
                              accountId,
                              accountSlug,
                            }),
                          )
                        }
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      className="text-[var(--workspace-shell-text-muted)] hover:text-red-500"
                      aria-label="Delete"
                      onClick={() =>
                        run('Template deleted', () =>
                          deleteAccountTemplateAction({
                            id: template.id,
                            accountId,
                            accountSlug,
                          }),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>

        {canEdit ? (
          <div className="mt-4 space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4">
            <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
              {editingId ? 'Edit template' : 'New template'}
            </h3>
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
            </div>
            {isEmail ? (
              <div>
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1"
                />
              </div>
            ) : null}
            {isHtml ? (
              <div>
                <Label>Body HTML</Label>
                <Textarea
                  rows={10}
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            ) : (
              <div>
                <Label>Body</Label>
                <Textarea
                  rows={6}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            {isEmail ? (
              <div>
                <Label>Signature</Label>
                <Textarea
                  rows={3}
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="mt-1"
                />
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              <Label>Set as default for this type</Label>
            </div>
            <Button
              type="button"
              disabled={pending || !name.trim()}
              className="bg-[var(--ozer-accent)] text-[#09111F]"
              onClick={() =>
                run(editingId ? 'Template saved' : 'Template created', () =>
                  upsertAccountTemplateAction({
                    id: editingId ?? undefined,
                    accountId,
                    accountSlug,
                    kind,
                    name,
                    description: description || null,
                    subject: subject || null,
                    bodyHtml,
                    bodyText,
                    signature: signature || null,
                    isDefault,
                  }),
                )
              }
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editingId ? 'Save changes' : 'Create template'}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
