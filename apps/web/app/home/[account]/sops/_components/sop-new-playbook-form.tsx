'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';

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
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { SopImportDraft } from '~/lib/ai/sop-import';

import {
  createSopPlaybookAction,
  importSopFromTextAction,
} from '../_lib/server/sops-actions';

const panelClass =
  'rounded-[24px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

type StepDraft = { title: string; body_md: string };

type SopNewPlaybookFormProps = {
  accountId: string;
  accountSlug: string;
};

export function SopNewPlaybookForm({
  accountId,
  accountSlug,
}: SopNewPlaybookFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'manual' | 'import'>('import');
  const [pending, startTransition] = useTransition();
  const [importPending, startImport] = useTransition();

  const [rawText, setRawText] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [recurrence, setRecurrence] = useState<
    'monthly' | 'weekly' | 'project' | 'ad_hoc'
  >('monthly');
  const [steps, setSteps] = useState<StepDraft[]>([
    { title: '', body_md: '' },
  ]);

  const libraryPath = pathsConfig.app.accountSops.replace('[account]', accountSlug);

  function applyDraft(draft: SopImportDraft) {
    setTitle(draft.title);
    setDescription(draft.description ?? '');
    setCategory(draft.category ?? '');
    setRecurrence(draft.recurrence ?? 'ad_hoc');
    setSteps(
      draft.steps.map((s) => ({
        title: s.title,
        body_md: s.body_md ?? '',
      })),
    );
    setMode('manual');
    toast.success('SOP structured — review steps below, then save.');
  }

  function handleImport() {
    startImport(async () => {
      try {
        const result = await importSopFromTextAction({
          accountId,
          rawText,
        });
        if (result?.draft) applyDraft(result.draft);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Import failed');
      }
    });
  }

  function handleSave() {
    const cleaned = steps
      .map((s) => ({
        title: s.title.trim(),
        body_md: s.body_md.trim() || null,
      }))
      .filter((s) => s.title.length > 0);

    if (!title.trim()) {
      toast.error('Add a playbook title.');
      return;
    }
    if (cleaned.length === 0) {
      toast.error('Add at least one step.');
      return;
    }

    startTransition(async () => {
      try {
        const result = await createSopPlaybookAction({
          accountId,
          accountSlug,
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          recurrence,
          steps: cleaned,
        });
        if (result?.playbookId) {
          router.push(
            pathsConfig.app.accountSopsPlaybook
              .replace('[account]', accountSlug)
              .replace('[playbookId]', result.playbookId),
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save playbook');
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:px-0">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'import' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('import')}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Import with AI
        </Button>
        <Button
          type="button"
          variant={mode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('manual')}
        >
          Build manually
        </Button>
      </div>

      {mode === 'import' ? (
        <div className={`${panelClass} space-y-4 p-6`}>
          <div>
            <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
              Paste existing docs or notes
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Drop in a Google Doc export, Notion page, email thread, or bullet
              list. AI will turn it into ordered steps you can edit before saving.
            </p>
          </div>
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={14}
            placeholder="Paste your process here…"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] font-mono text-sm text-[var(--workspace-shell-text)]"
          />
          <Button
            type="button"
            disabled={importPending || rawText.trim().length < 20}
            onClick={handleImport}
            className="ozer-gradient-btn"
          >
            {importPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Structure into steps
          </Button>
        </div>
      ) : null}

      <div className={`${panelClass} space-y-5 p-6`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sop-title">Playbook title</Label>
            <Input
              id="sop-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly SEO & PPC reporting"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sop-category">Category</Label>
            <Input
              id="sop-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Web design, SEO, PPC…"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
            />
          </div>
          <div className="space-y-2">
            <Label>Typical cadence</Label>
            <Select
              value={recurrence}
              onValueChange={(v) =>
                setRecurrence(v as typeof recurrence)
              }
            >
              <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="project">Per project</SelectItem>
                <SelectItem value="ad_hoc">Ad hoc</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sop-desc">Description</Label>
            <Textarea
              id="sop-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Steps</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setSteps((prev) => [...prev, { title: '', body_md: '' }])
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add step
            </Button>
          </div>
          {steps.map((step, index) => (
            <div
              key={index}
              className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4"
            >
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground mt-2 w-6 shrink-0 text-sm">
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={step.title}
                    onChange={(e) =>
                      setSteps((prev) =>
                        prev.map((s, i) =>
                          i === index ? { ...s, title: e.target.value } : s,
                        ),
                      )
                    }
                    placeholder="Step title"
                    className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                  />
                  <Textarea
                    value={step.body_md}
                    onChange={(e) =>
                      setSteps((prev) =>
                        prev.map((s, i) =>
                          i === index ? { ...s, body_md: e.target.value } : s,
                        ),
                      )
                    }
                    rows={2}
                    placeholder="Instructions (optional)"
                    className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-sm text-[var(--workspace-shell-text)]"
                  />
                </div>
                {steps.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setSteps((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="ozer-gradient-btn"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save playbook
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={libraryPath}>Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
