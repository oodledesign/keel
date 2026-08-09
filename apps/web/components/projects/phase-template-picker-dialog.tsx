'use client';

import { useMemo, useState } from 'react';

import { Check, LayoutTemplate, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { cn } from '@kit/ui/utils';

import {
  getPhaseTemplatePickerCopy,
  isBuiltinPhaseTemplateName,
} from '~/lib/projects/phase-template-builtins';

export type PhaseTemplatePickerItem = {
  id: string;
  name: string;
  description: string | null;
  phaseCount: number;
  taskCount?: number;
  phaseNames?: string[];
  isBuiltin?: boolean;
};

const BUILTIN_ORDER = [
  'Standard delivery',
  'Website design',
  'Project board',
] as const;

function sortTemplates(items: PhaseTemplatePickerItem[]) {
  const rank = (name: string) => {
    const index = BUILTIN_ORDER.indexOf(name as (typeof BUILTIN_ORDER)[number]);
    return index === -1 ? 100 : index;
  };

  return [...items].sort((a, b) => {
    const aBuiltin = a.isBuiltin ?? isBuiltinPhaseTemplateName(a.name);
    const bBuiltin = b.isBuiltin ?? isBuiltinPhaseTemplateName(b.name);
    if (aBuiltin !== bBuiltin) return aBuiltin ? -1 : 1;
    if (aBuiltin && bBuiltin) return rank(a.name) - rank(b.name);
    return a.name.localeCompare(b.name);
  });
}

export function PhaseTemplatePickerDialog({
  open,
  onOpenChange,
  templates,
  applyingId,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: PhaseTemplatePickerItem[];
  applyingId: string | null;
  onApply: (templateId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sorted = useMemo(() => sortTemplates(templates), [templates]);
  const selected =
    sorted.find((item) => item.id === selectedId) ?? sorted[0] ?? null;

  const applying = Boolean(applyingId);
  const builtins = sorted.filter(
    (item) => item.isBuiltin ?? isBuiltinPhaseTemplateName(item.name),
  );
  const customs = sorted.filter(
    (item) => !(item.isBuiltin ?? isBuiltinPhaseTemplateName(item.name)),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (applying) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a phase template</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Pick how this project should be organised. You can still add,
            rename, or remove phases afterwards.
          </DialogDescription>
        </DialogHeader>

        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            No templates available yet.
          </p>
        ) : (
          <div className="space-y-5 pt-1">
            {builtins.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  Built-in
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {builtins.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      selected={selected?.id === template.id}
                      disabled={applying}
                      onSelect={() => setSelectedId(template.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {customs.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  Workspace templates
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {customs.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      selected={selected?.id === template.id}
                      disabled={applying}
                      onSelect={() => setSelectedId(template.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {selected ? (
              <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-[var(--workspace-shell-text)]">
                      {selected.name}
                    </p>
                    <TemplateDetail template={selected} />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                    disabled={applying || !selected}
                    onClick={() => onApply(selected.id)}
                  >
                    {applyingId === selected.id ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Applying…
                      </>
                    ) : (
                      `Apply “${selected.name}”`
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  selected,
  disabled,
  onSelect,
}: {
  template: PhaseTemplatePickerItem;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const copy = getPhaseTemplatePickerCopy(template.name);
  const blurb =
    copy.blurb ||
    template.description?.trim() ||
    `${template.phaseCount} phase${template.phaseCount === 1 ? '' : 's'}`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex h-full flex-col rounded-xl border p-3 text-left transition-colors',
        selected
          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
          : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--workspace-shell-panel-hover)]',
        disabled && 'opacity-60',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)]">
          <LayoutTemplate className="h-3.5 w-3.5" />
        </span>
        {selected ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ozer-accent)] text-[var(--ozer-white)]">
            <Check className="h-3 w-3" />
          </span>
        ) : null}
      </div>
      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
        {template.name}
      </p>
      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
        {blurb}
      </p>
      <p className="mt-auto pt-3 text-[11px] text-[var(--workspace-shell-text-muted)]">
        {template.phaseCount} phase{template.phaseCount === 1 ? '' : 's'}
        {(template.taskCount ?? 0) > 0
          ? ` · ${template.taskCount} task stub${template.taskCount === 1 ? '' : 's'}`
          : null}
      </p>
    </button>
  );
}

function TemplateDetail({ template }: { template: PhaseTemplatePickerItem }) {
  const copy = getPhaseTemplatePickerCopy(template.name);
  const blurb = copy.blurb || template.description?.trim();

  return (
    <div className="space-y-2 text-sm text-[var(--workspace-shell-text-muted)]">
      {blurb ? <p>{blurb}</p> : null}
      {copy.bestFor ? (
        <p>
          <span className="font-medium text-[var(--workspace-shell-text)]">
            Best for:{' '}
          </span>
          {copy.bestFor}
        </p>
      ) : null}
      {(template.phaseNames?.length ?? 0) > 0 ? (
        <p className="text-xs">{template.phaseNames!.join(' → ')}</p>
      ) : null}
    </div>
  );
}
