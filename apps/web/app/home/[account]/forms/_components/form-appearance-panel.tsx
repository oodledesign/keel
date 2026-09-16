'use client';

import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupItemLabel,
} from '@kit/ui/radio-group';

import {
  WORKSPACE_FORM_LAYOUTS,
  WORKSPACE_FORM_LAYOUT_LABELS,
  WORKSPACE_FORM_PAGE_BACKGROUNDS,
  WORKSPACE_FORM_PAGE_BACKGROUND_LABELS,
  WORKSPACE_FORM_PRESENTATIONS,
  WORKSPACE_FORM_PRESENTATION_LABELS,
  type WorkspaceFormLayout,
  type WorkspaceFormPageBackground,
  type WorkspaceFormPresentation,
  parseThemeHex,
} from '~/lib/workspace-forms/form-theme';
import type { WorkspaceFormsMode } from '~/lib/workspace-forms/forms-mode';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

type BrandColors = {
  primary: string;
  accent: string;
};

type Props = {
  formsMode: WorkspaceFormsMode;
  brandColors: BrandColors;
  pageBackground: WorkspaceFormPageBackground;
  layout: WorkspaceFormLayout;
  presentation: WorkspaceFormPresentation;
  primaryColor: string | null;
  accentColor: string | null;
  onPageBackground: (value: WorkspaceFormPageBackground) => void;
  onLayout: (value: WorkspaceFormLayout) => void;
  onPresentation: (value: WorkspaceFormPresentation) => void;
  onPrimaryColor: (value: string | null) => void;
  onAccentColor: (value: string | null) => void;
};

function ColorField({
  label,
  description,
  value,
  fallback,
  onChange,
  testId,
}: {
  label: string;
  description: string;
  value: string | null;
  fallback: string;
  onChange: (value: string | null) => void;
  testId: string;
}) {
  const current = value || fallback;

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <p className={`text-xs ${workspaceTextMuted}`}>{description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          className="h-9 w-12 cursor-pointer rounded border border-[color:var(--workspace-shell-border)] bg-transparent"
          value={current.startsWith('#') ? current.slice(0, 7) : '#ffffff'}
          aria-label={label}
          onChange={(event) => onChange(parseThemeHex(event.target.value))}
          data-test={`${testId}-swatch`}
        />
        <Input
          value={value ?? ''}
          placeholder={fallback}
          className="max-w-[140px] font-mono text-sm"
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value.trim();
            if (!next) {
              onChange(null);
              return;
            }
            const parsed = parseThemeHex(next);
            if (parsed) onChange(parsed);
          }}
          data-test={testId}
        />
      </div>
    </div>
  );
}

export function FormAppearancePanel({
  formsMode,
  brandColors,
  pageBackground,
  layout,
  presentation,
  primaryColor,
  accentColor,
  onPageBackground,
  onLayout,
  onPresentation,
  onPrimaryColor,
  onAccentColor,
}: Props) {
  const full = formsMode === 'full';

  return (
    <section
      className={`${workspacePanelCard} space-y-4 p-5`}
      data-test="form-appearance-panel"
    >
      <div>
        <h2 className={`text-base font-semibold ${workspaceText}`}>
          Appearance
        </h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          Colours default to workspace brand settings. Overrides apply to this
          form only.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ColorField
          label="Primary colour"
          description="Used for the brand-gradient page background."
          value={primaryColor}
          fallback={brandColors.primary}
          onChange={onPrimaryColor}
          testId="form-primary-color"
        />
        <ColorField
          label="Accent colour"
          description="Buttons and highlights on the public form."
          value={accentColor}
          fallback={brandColors.accent}
          onChange={onAccentColor}
          testId="form-accent-color"
        />
      </div>

      <div className="grid gap-2">
        <Label>Page background</Label>
        <RadioGroup
          value={pageBackground}
          onValueChange={(value) =>
            onPageBackground(value as WorkspaceFormPageBackground)
          }
          className="grid gap-2 sm:grid-cols-2"
          data-test="form-page-background"
        >
          {WORKSPACE_FORM_PAGE_BACKGROUNDS.map((value) => {
            const meta = WORKSPACE_FORM_PAGE_BACKGROUND_LABELS[value];
            const selected = pageBackground === value;
            return (
              <RadioGroupItemLabel
                key={value}
                selected={selected}
                className="h-full items-start gap-3 space-x-0"
              >
                <RadioGroupItem value={value} className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className={`font-medium ${workspaceText}`}>
                    {meta.label}
                  </span>
                  <span className={`text-xs ${workspaceTextMuted}`}>
                    {meta.description}
                  </span>
                </span>
              </RadioGroupItemLabel>
            );
          })}
        </RadioGroup>
      </div>

      {full ? (
        <>
          <div className="grid gap-2">
            <Label>Presentation</Label>
            <p className={`text-xs ${workspaceTextMuted}`}>
              Classic keeps every question on one page. Steps shows one step at
              a time with Next, Back, and progress.
            </p>
            <RadioGroup
              value={presentation}
              onValueChange={(value) =>
                onPresentation(value as WorkspaceFormPresentation)
              }
              className="grid gap-2 sm:grid-cols-2"
              data-test="form-presentation"
            >
              {WORKSPACE_FORM_PRESENTATIONS.map((value) => {
                const meta = WORKSPACE_FORM_PRESENTATION_LABELS[value];
                const selected = presentation === value;
                return (
                  <RadioGroupItemLabel
                    key={value}
                    selected={selected}
                    className="h-full items-start gap-3 space-x-0"
                  >
                    <RadioGroupItem value={value} className="mt-0.5" />
                    <span className="grid gap-0.5">
                      <span className={`font-medium ${workspaceText}`}>
                        {meta.label}
                      </span>
                      <span className={`text-xs ${workspaceTextMuted}`}>
                        {meta.description}
                      </span>
                    </span>
                  </RadioGroupItemLabel>
                );
              })}
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label>Public layout</Label>
            <p className={`text-xs ${workspaceTextMuted}`}>
              Event / two-column is the RSVP public layout.
            </p>
            <RadioGroup
              value={layout}
              onValueChange={(value) => onLayout(value as WorkspaceFormLayout)}
              className="grid gap-2 sm:grid-cols-2"
              data-test="form-page-layout"
            >
              {WORKSPACE_FORM_LAYOUTS.map((value) => {
                const meta = WORKSPACE_FORM_LAYOUT_LABELS[value];
                const selected = layout === value;
                return (
                  <RadioGroupItemLabel
                    key={value}
                    selected={selected}
                    className="h-full items-start gap-3 space-x-0"
                  >
                    <RadioGroupItem value={value} className="mt-0.5" />
                    <span className="grid gap-0.5">
                      <span className={`font-medium ${workspaceText}`}>
                        {meta.label}
                      </span>
                      <span className={`text-xs ${workspaceTextMuted}`}>
                        {meta.description}
                      </span>
                    </span>
                  </RadioGroupItemLabel>
                );
              })}
            </RadioGroup>
          </div>
        </>
      ) : null}
    </section>
  );
}
