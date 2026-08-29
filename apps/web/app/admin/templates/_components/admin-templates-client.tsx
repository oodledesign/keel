'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import {
  deleteSystemTemplateAction,
  upsertSystemTemplateAction,
} from '~/admin/templates/_lib/server/templates.actions';
import {
  CONTENT_TEMPLATE_KINDS,
  type ContentTemplateKind,
  type SystemContentTemplate,
} from '~/lib/content-templates/types';

const KIND_LABELS: Record<ContentTemplateKind, string> = {
  proposal_html: 'Proposal HTML',
  proposal_email: 'Proposal email',
  contract_email: 'Contract email',
  invoice_email: 'Invoice email',
  email_reply: 'Email reply',
  survey_report_html: 'Survey report HTML',
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

type Props = {
  initialTemplates: SystemContentTemplate[];
};

export function AdminTemplatesClient({ initialTemplates }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<ContentTemplateKind>('proposal_html');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [signature, setSignature] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  const filtered = useMemo(
    () => initialTemplates.filter((t) => t.kind === kind),
    [initialTemplates, kind],
  );

  const isEmailKind =
    kind === 'proposal_email' ||
    kind === 'contract_email' ||
    kind === 'invoice_email' ||
    kind === 'email_reply';
  const isHtmlKind = kind === 'proposal_html';
  const hasSignature =
    kind === 'proposal_email' ||
    kind === 'contract_email' ||
    kind === 'invoice_email';

  function resetForm(nextKind = kind) {
    setEditingId(null);
    setName('');
    setSlug('');
    setDescription('');
    setSubject('');
    setBodyHtml('');
    setBodyText('');
    setSignature('');
    setIsActive(true);
    setSortOrder(filtered.length);
    setKind(nextKind);
  }

  function loadTemplate(template: SystemContentTemplate) {
    setEditingId(template.id);
    setKind(template.kind);
    setName(template.name);
    setSlug(template.slug);
    setDescription(template.description ?? '');
    setSubject(template.subject ?? '');
    setBodyHtml(template.bodyHtml);
    setBodyText(template.bodyText);
    setSignature(template.signature ?? '');
    setIsActive(template.isActive);
    setSortOrder(template.sortOrder);
  }

  function save() {
    startTransition(async () => {
      try {
        await upsertSystemTemplateAction({
          id: editingId ?? undefined,
          kind,
          name,
          slug: slug || slugify(name),
          description: description || null,
          subject: subject || null,
          bodyHtml,
          bodyText,
          signature: signature || null,
          isActive,
          sortOrder,
        });
        toast.success(editingId ? 'Template updated' : 'Template created');
        resetForm(kind);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save template',
        );
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm('Delete this system template?')) return;
    startTransition(async () => {
      try {
        await deleteSystemTemplateAction({ id });
        toast.success('Template deleted');
        if (editingId === id) resetForm(kind);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete',
        );
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="flex flex-wrap gap-1 rounded-full border p-1 text-xs">
          {CONTENT_TEMPLATE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => resetForm(k)}
              className={`rounded-full px-3 py-1.5 font-medium ${
                kind === k ? 'bg-primary text-primary-foreground' : ''
              }`}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{KIND_LABELS[kind]}</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => resetForm(kind)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New
            </Button>
          </div>
          <ul className="divide-y rounded-lg border">
            {filtered.length === 0 ? (
              <li className="text-muted-foreground p-3 text-sm">
                No templates yet.
              </li>
            ) : (
              filtered.map((template) => (
                <li key={template.id} className="flex items-start gap-2 p-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => loadTemplate(template)}
                  >
                    <p className="truncate text-sm font-medium">
                      {template.name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {template.slug}
                      {template.isActive ? '' : ' · inactive'}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                    onClick={() => remove(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </aside>

      <section className="space-y-4 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">
          {editingId ? 'Edit template' : 'New template'}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editingId) setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div>
            <Label htmlFor="tpl-slug">Slug</Label>
            <Input
              id="tpl-slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="tpl-desc">Description</Label>
          <Input
            id="tpl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="tpl-sort">Sort order</Label>
            <Input
              id="tpl-sort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Active</Label>
          </div>
        </div>

        {isEmailKind && kind !== 'email_reply' ? (
          <div>
            <Label htmlFor="tpl-subject">Subject</Label>
            <Input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        ) : null}

        {isHtmlKind ? (
          <div>
            <Label htmlFor="tpl-html">Body HTML</Label>
            <Textarea
              id="tpl-html"
              rows={14}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="tpl-text">Body text</Label>
            <Textarea
              id="tpl-text"
              rows={10}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
            />
          </div>
        )}

        {hasSignature ? (
          <div>
            <Label htmlFor="tpl-sig">Signature</Label>
            <Textarea
              id="tpl-sig"
              rows={4}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
          </div>
        ) : null}

        <Button type="button" disabled={pending || !name.trim()} onClick={save}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {editingId ? 'Save changes' : 'Create template'}
        </Button>
      </section>
    </div>
  );
}
