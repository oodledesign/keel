'use client';

import type { ReactNode } from 'react';

import { Switch } from '@kit/ui/switch';

import type {
  BrochureDisplayOptions,
  BrochureFooterSettings,
  BrochureSettings,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { DEFAULT_BROCHURE_NOTICE } from '~/lib/commercial/brochure-pdf/brochure-footer';

import {
  BrochureMergeFieldHint,
  BrochureMergeTextField,
} from './brochure-merge-text-field';

const RENDER_TOGGLES: Array<{
  key:
    | 'showReducedPrice'
    | 'showWebsiteListingButton'
    | 'showSlideshowBrochureButton';
  label: string;
}> = [
  { key: 'showReducedPrice', label: 'Reduced price badge' },
  { key: 'showWebsiteListingButton', label: 'Website listing button' },
  { key: 'showSlideshowBrochureButton', label: 'Online brochure button' },
];

function SwitchRow({
  id,
  label,
  checked,
  onCheckedChange,
  children,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="text-sm text-[var(--workspace-shell-text)]"
        >
          {label}
        </label>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {checked ? children : null}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
      {children}
    </p>
  );
}

/** Brochure-wide options: the footer on every page, and buttons and badges. */
export function BrochureSettingsPanel({
  settings,
  officeLine,
  display,
  onSettingsChange,
  onDisplayChange,
}: {
  settings: BrochureSettings;
  /** The office details the footer shows unless replaced. */
  officeLine: string;
  display: BrochureDisplayOptions;
  onSettingsChange: (settings: BrochureSettings) => void;
  onDisplayChange: (display: BrochureDisplayOptions) => void;
}) {
  const footer = settings.footer ?? {};

  function setFooter(patch: Partial<BrochureFooterSettings>) {
    onSettingsChange({ ...settings, footer: { ...footer, ...patch } });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Brochure settings
        </h3>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          These apply to every page.
        </p>
      </div>

      <section className="space-y-4">
        <h4 className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          Footer
        </h4>
        <BrochureMergeFieldHint />
        <SwitchRow
          id="brochure-footer-office"
          label="Office details"
          checked={footer.showOffice !== false}
          onCheckedChange={(checked) => setFooter({ showOffice: checked })}
        >
          <BrochureMergeTextField
            label="Office details"
            value={footer.officeText ?? ''}
            placeholder={officeLine || 'Agency name, address and phone'}
            onChange={(text) => setFooter({ officeText: text })}
          />
          <Hint>Leave blank to use the agency and branch details.</Hint>
        </SwitchRow>
        <SwitchRow
          id="brochure-footer-notice"
          label="Notice"
          checked={footer.showNotice !== false}
          onCheckedChange={(checked) => setFooter({ showNotice: checked })}
        >
          <BrochureMergeTextField
            label="Notice"
            value={footer.noticeText ?? ''}
            placeholder={DEFAULT_BROCHURE_NOTICE}
            onChange={(text) => setFooter({ noticeText: text })}
          />
        </SwitchRow>
        <SwitchRow
          id="brochure-footer-page-numbers"
          label="Page numbers"
          checked={footer.showPageNumbers !== false}
          onCheckedChange={(checked) => setFooter({ showPageNumbers: checked })}
        />
        <Hint>The cover page has no footer.</Hint>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          Buttons and badges
        </h4>
        {RENDER_TOGGLES.map((toggle) => (
          <SwitchRow
            key={toggle.key}
            id={`brochure-settings-${toggle.key}`}
            label={toggle.label}
            checked={display[toggle.key]}
            onCheckedChange={(checked) =>
              onDisplayChange({ ...display, [toggle.key]: checked })
            }
          />
        ))}
        <Hint>Buttons only appear when the listing has that link.</Hint>
      </section>
    </div>
  );
}
