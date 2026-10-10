'use client';

import { useState } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';

import {
  BROCHURE_TEMPLATE_OPTIONS,
  type BrochureDisplayOptions,
  type BrochureOrientation,
  type BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';

import type { BrochureWizardData } from './brochure-wizard';

const DISPLAY_TOGGLES: Array<{
  key: keyof BrochureDisplayOptions;
  label: string;
  /** Applied when the PDF is drawn, so it works on an existing layout too. */
  atRender?: boolean;
}> = [
  { key: 'showRent', label: 'Rent' },
  { key: 'showPrice', label: 'Price' },
  { key: 'showSize', label: 'Size' },
  { key: 'showRates', label: 'Business rates' },
  { key: 'showServiceCharge', label: 'Service charge' },
  { key: 'showEstateCharge', label: 'Estate charge' },
  { key: 'showReducedPrice', label: 'Reduced price badge', atRender: true },
  {
    key: 'showWebsiteListingButton',
    label: 'Website listing button',
    atRender: true,
  },
  {
    key: 'showSlideshowBrochureButton',
    label: 'Online brochure button',
    atRender: true,
  },
];

const ORIENTATIONS: Array<{ id: BrochureOrientation; label: string }> = [
  { id: 'landscape', label: 'Landscape' },
  { id: 'portrait', label: 'Portrait' },
];

function OptionCard({
  selected,
  title,
  description,
  onClick,
  disabled,
}: {
  selected: boolean;
  title: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-lg border p-3 text-left transition-colors disabled:opacity-50',
        selected
          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
          : 'border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] hover:bg-[var(--workspace-shell-panel-hover)]',
      )}
    >
      <span className="block text-sm font-medium text-[var(--workspace-shell-text)]">
        {title}
      </span>
      {description ? (
        <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
          {description}
        </span>
      ) : null}
    </button>
  );
}

export function BrochureSetupStep({
  data,
  orientation,
  templateId,
  display,
  busy,
  onOrientationChange,
  onTemplateChange,
  onDisplayChange,
  onStart,
}: {
  data: BrochureWizardData;
  orientation: BrochureOrientation;
  templateId: BrochureTemplateId;
  display: BrochureDisplayOptions;
  busy: boolean;
  onOrientationChange: (orientation: BrochureOrientation) => void;
  onTemplateChange: (templateId: BrochureTemplateId) => void;
  onDisplayChange: (display: BrochureDisplayOptions) => void;
  onStart: (mode: 'continue' | 'fresh') => void;
}) {
  const saved = data.saved[orientation];
  const [mode, setMode] = useState<'continue' | 'fresh'>(
    saved ? 'continue' : 'fresh',
  );
  const effectiveMode = saved ? mode : 'fresh';
  const photoCount = data.images.length;
  const planCount = data.floorplans.length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Orientation
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {ORIENTATIONS.map((o) => (
              <OptionCard
                key={o.id}
                selected={orientation === o.id}
                title={o.label}
                description={
                  data.saved[o.id]
                    ? `Saved layout, ${data.saved[o.id]?.pageCount} pages`
                    : 'Not created yet'
                }
                disabled={busy}
                onClick={() => {
                  onOrientationChange(o.id);
                  setMode(data.saved[o.id] ? 'continue' : 'fresh');
                }}
              />
            ))}
          </div>
        </section>

        {saved ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Pages
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <OptionCard
                selected={effectiveMode === 'continue'}
                title="Continue where you left off"
                description={`Keep your ${saved.pageCount} edited pages`}
                disabled={busy}
                onClick={() => setMode('continue')}
              />
              <OptionCard
                selected={effectiveMode === 'fresh'}
                title="Start fresh"
                description="Rebuild the pages from the listing. Your edits are replaced."
                disabled={busy}
                onClick={() => setMode('fresh')}
              />
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Style
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {BROCHURE_TEMPLATE_OPTIONS.map((t) => (
              <OptionCard
                key={t.id}
                selected={templateId === t.id}
                title={t.label}
                description={t.description}
                disabled={busy}
                onClick={() => onTemplateChange(t.id)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Show on the brochure
            </h3>
            {effectiveMode === 'continue' ? (
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Rent, price and charges are already in your saved pages. Edit
                them in the next step, or start fresh to rebuild them.
              </p>
            ) : null}
          </div>
          <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {DISPLAY_TOGGLES.map((item) => {
              const locked = effectiveMode === 'continue' && !item.atRender;
              return (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3"
                >
                  <label
                    htmlFor={`brochure-display-${item.key}`}
                    className={cn(
                      'text-sm text-[var(--workspace-shell-text)]',
                      locked && 'opacity-50',
                    )}
                  >
                    {item.label}
                  </label>
                  <Switch
                    id={`brochure-display-${item.key}`}
                    checked={display[item.key]}
                    disabled={busy || locked}
                    onCheckedChange={(checked) =>
                      onDisplayChange({ ...display, [item.key]: checked })
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex items-center justify-between gap-4 border-t border-[var(--workspace-shell-border)] pt-5">
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {photoCount} {photoCount === 1 ? 'photo' : 'photos'} and {planCount}{' '}
            {planCount === 1 ? 'floor plan' : 'floor plans'} available
          </p>
          <Button
            type="button"
            disabled={busy}
            onClick={() => onStart(effectiveMode)}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {effectiveMode === 'continue' ? 'Continue' : 'Build pages'}
          </Button>
        </div>
      </div>
    </div>
  );
}
