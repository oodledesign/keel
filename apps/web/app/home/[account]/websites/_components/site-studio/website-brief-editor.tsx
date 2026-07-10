'use client';

import { useState, useTransition } from 'react';

import { Plus, Sparkles, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  emptyWebsiteBrief,
  type WebsiteBrief,
  type WebsiteTargetStack,
} from '~/lib/websites/planning-types';

import {
  saveWebsiteBrief,
  suggestWebsiteBrief,
} from '../../_lib/server/site-studio-actions';

const STACK_OPTIONS: Array<{ value: WebsiteTargetStack; label: string }> = [
  { value: 'undecided', label: 'Undecided' },
  { value: 'webflow', label: 'Webflow (Client-First)' },
  { value: 'astro', label: 'Astro' },
  { value: 'next', label: 'Next.js' },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[var(--workspace-shell-text)]">{label}</Label>
      {hint ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

export function WebsiteBriefEditor({
  accountId,
  websiteId,
  initialBrief,
  canEdit,
}: {
  accountId: string;
  websiteId: string;
  initialBrief: WebsiteBrief | null;
  canEdit: boolean;
}) {
  const [brief, setBrief] = useState<WebsiteBrief>(
    initialBrief ?? emptyWebsiteBrief(),
  );
  const [aiNotes, setAiNotes] = useState('');
  const [aiUrl, setAiUrl] = useState('');
  const [isSaving, startSaving] = useTransition();
  const [isSuggesting, startSuggesting] = useTransition();

  const inputClass =
    'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]';

  function patch(update: Partial<WebsiteBrief>) {
    setBrief((current) => ({ ...current, ...update }));
  }

  function save() {
    startSaving(async () => {
      try {
        await saveWebsiteBrief({ accountId, websiteId, brief });
        toast.success('Brief saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save brief',
        );
      }
    });
  }

  function suggest() {
    if (!aiNotes.trim() && !aiUrl.trim()) {
      toast.error('Paste discovery notes or a website URL first');
      return;
    }

    startSuggesting(async () => {
      try {
        const suggested = await suggestWebsiteBrief({
          accountId,
          websiteId,
          notes: aiNotes.trim() || undefined,
          websiteUrl: aiUrl.trim() || undefined,
        });
        setBrief(suggested);
        toast.success('Brief drafted — review every field before moving on');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not draft brief',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {canEdit ? (
        <div className="space-y-3 rounded-xl border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent)]/5 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Draft with AI
            </p>
          </div>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Paste discovery notes and/or the client&apos;s current website URL. AI
            fills the brief; you correct it. This brief powers the sitemap,
            wireframes, copy, and SEO suggestions.
          </p>
          <Textarea
            value={aiNotes}
            onChange={(event) => setAiNotes(event.target.value)}
            rows={4}
            placeholder="Discovery call notes, proposal snippets, anything…"
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={aiUrl}
              onChange={(event) => setAiUrl(event.target.value)}
              placeholder="Current website URL (optional)"
              className={`${inputClass} max-w-sm`}
            />
            <Button
              type="button"
              size="sm"
              onClick={suggest}
              disabled={isSuggesting}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isSuggesting ? 'Drafting…' : 'Suggest brief'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Organisation">
          <Input
            value={brief.orgName}
            readOnly={!canEdit}
            onChange={(event) => patch({ orgName: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Geography" hint="Locations / service areas (drives local SEO)">
          <Input
            value={brief.geography}
            readOnly={!canEdit}
            onChange={(event) => patch({ geography: event.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Brand summary">
        <Textarea
          value={brief.brandSummary}
          readOnly={!canEdit}
          rows={2}
          onChange={(event) => patch({ brandSummary: event.target.value })}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Offer" hint="What they sell, how it's packaged">
          <Textarea
            value={brief.offer}
            readOnly={!canEdit}
            rows={3}
            onChange={(event) => patch({ offer: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Audience" hint="Who buys, and who influences the decision">
          <Textarea
            value={brief.audience}
            readOnly={!canEdit}
            rows={3}
            onChange={(event) => patch({ audience: event.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Jobs to be done"
          hint="The conversation the site answers for a visitor"
        >
          <Textarea
            value={brief.jobsToBeDone}
            readOnly={!canEdit}
            rows={3}
            onChange={(event) => patch({ jobsToBeDone: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Objections" hint="Doubts the site must overcome">
          <Textarea
            value={brief.objections}
            readOnly={!canEdit}
            rows={3}
            onChange={(event) => patch({ objections: event.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Competitors">
        <Textarea
          value={brief.competitors}
          readOnly={!canEdit}
          rows={2}
          onChange={(event) => patch({ competitors: event.target.value })}
          className={inputClass}
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[var(--workspace-shell-text)]">
            Reference sites (3 recommended)
          </Label>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-[var(--workspace-shell-text-muted)]"
              onClick={() =>
                patch({
                  references: [...brief.references, { url: '', why: '' }],
                })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add reference
            </Button>
          ) : null}
        </div>
        {brief.references.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            No references yet — these become the visual standard for the build.
          </p>
        ) : (
          <div className="space-y-2">
            {brief.references.map((ref, index) => (
              <div key={index} className="flex items-start gap-2">
                <Input
                  value={ref.url}
                  readOnly={!canEdit}
                  placeholder="https://…"
                  onChange={(event) =>
                    patch({
                      references: brief.references.map((item, i) =>
                        i === index ? { ...item, url: event.target.value } : item,
                      ),
                    })
                  }
                  className={`${inputClass} max-w-xs`}
                />
                <Input
                  value={ref.why}
                  readOnly={!canEdit}
                  placeholder="Why this works…"
                  onChange={(event) =>
                    patch({
                      references: brief.references.map((item, i) =>
                        i === index ? { ...item, why: event.target.value } : item,
                      ),
                    })
                  }
                  className={inputClass}
                />
                {canEdit ? (
                  <button
                    type="button"
                    className="mt-2.5 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                    onClick={() =>
                      patch({
                        references: brief.references.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tone">
          <Textarea
            value={brief.tone}
            readOnly={!canEdit}
            rows={2}
            onChange={(event) => patch({ tone: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Constraints" hint="Brand rules, tech limits, must-keeps">
          <Textarea
            value={brief.constraints}
            readOnly={!canEdit}
            rows={2}
            onChange={(event) => patch({ constraints: event.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Conversion goals" hint="What a successful visit looks like">
        <Textarea
          value={brief.conversionGoals}
          readOnly={!canEdit}
          rows={2}
          onChange={(event) => patch({ conversionGoals: event.target.value })}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-end gap-6">
        <Field label="Target stack" hint="Drives the export pack">
          <Select
            value={brief.targetStack}
            onValueChange={(value) =>
              patch({ targetStack: value as WebsiteTargetStack })
            }
            disabled={!canEdit}
          >
            <SelectTrigger className={`${inputClass} w-56`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STACK_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-center gap-2 pb-1.5">
          <Switch
            checked={brief.cmsNeeded}
            onCheckedChange={(checked) => patch({ cmsNeeded: checked })}
            disabled={!canEdit}
          />
          <span className="text-sm text-[var(--workspace-shell-text)]/80">
            Client needs a CMS
          </span>
        </div>
      </div>

      {canEdit ? (
        <Button type="button" onClick={save} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save brief'}
        </Button>
      ) : null}
    </div>
  );
}
