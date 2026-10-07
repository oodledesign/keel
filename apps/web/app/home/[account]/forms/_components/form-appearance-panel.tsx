'use client';

import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupItemLabel,
} from '@kit/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';

import { validateFormCustomCss } from '~/lib/workspace-forms/form-custom-css';
import {
  WORKSPACE_FORM_CORNER_LABELS,
  WORKSPACE_FORM_CORNER_STYLES,
  WORKSPACE_FORM_CUSTOM_CSS_MAX,
  WORKSPACE_FORM_FONTS,
  WORKSPACE_FORM_FONT_LABELS,
  WORKSPACE_FORM_LAYOUTS,
  WORKSPACE_FORM_LAYOUT_LABELS,
  WORKSPACE_FORM_LOGO_MODES,
  WORKSPACE_FORM_PAGE_BACKGROUNDS,
  WORKSPACE_FORM_PAGE_BACKGROUND_LABELS,
  WORKSPACE_FORM_PRESENTATIONS,
  WORKSPACE_FORM_PRESENTATION_LABELS,
  type WorkspaceFormCornerStyle,
  type WorkspaceFormFont,
  type WorkspaceFormLayout,
  type WorkspaceFormLogoMode,
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

export type FormBrandingValues = {
  backgroundColor: string | null;
  fontFamily: WorkspaceFormFont;
  cornerStyle: WorkspaceFormCornerStyle;
  logoMode: WorkspaceFormLogoMode;
  logoUrl: string | null;
  customCss: string;
};

const LOGO_MODE_LABELS: Record<WorkspaceFormLogoMode, string> = {
  brand: 'Workspace logo',
  custom: 'Custom logo URL',
  none: 'No logo',
};

type Props = {
  branding: FormBrandingValues;
  onBranding: (patch: Partial<FormBrandingValues>) => void;
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
  branding,
  onBranding,
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
  const cssError = validateFormCustomCss(branding.customCss);

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

      <div className="grid gap-4 md:grid-cols-2" data-test="form-branding">
        <ColorField
          label="Page colour"
          description="Solid page background (when not using the brand gradient)."
          value={branding.backgroundColor}
          fallback="#FBF6EC"
          onChange={(value) => onBranding({ backgroundColor: value })}
          testId="form-background-color"
        />
        <div className="grid gap-1.5">
          <Label>Font</Label>
          <p className={`text-xs ${workspaceTextMuted}`}>
            System fonts only, so the form stays fast on your website.
          </p>
          <Select
            value={branding.fontFamily}
            onValueChange={(value) =>
              onBranding({ fontFamily: value as WorkspaceFormFont })
            }
          >
            <SelectTrigger data-test="form-font">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKSPACE_FORM_FONTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {WORKSPACE_FORM_FONT_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Corners</Label>
          <Select
            value={branding.cornerStyle}
            onValueChange={(value) =>
              onBranding({ cornerStyle: value as WorkspaceFormCornerStyle })
            }
          >
            <SelectTrigger data-test="form-corner-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKSPACE_FORM_CORNER_STYLES.map((value) => (
                <SelectItem key={value} value={value}>
                  {WORKSPACE_FORM_CORNER_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Logo</Label>
          <Select
            value={branding.logoMode}
            onValueChange={(value) =>
              onBranding({ logoMode: value as WorkspaceFormLogoMode })
            }
          >
            <SelectTrigger data-test="form-logo-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKSPACE_FORM_LOGO_MODES.map((value) => (
                <SelectItem key={value} value={value}>
                  {LOGO_MODE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {branding.logoMode === 'custom' ? (
            <Input
              value={branding.logoUrl ?? ''}
              placeholder="https://example.com/logo.png"
              spellCheck={false}
              onChange={(event) =>
                onBranding({ logoUrl: event.target.value.trim() || null })
              }
              data-test="form-logo-url"
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Custom CSS (optional)</Label>
        <p className={`text-xs ${workspaceTextMuted}`}>
          Applies to this form only. Target <code>.ozer-form-card</code>,{' '}
          <code>.ozer-form-title</code>, <code>.ozer-form-submit</code>, or{' '}
          <code>input</code>, <code>label</code>, <code>button</code>. External
          resources (url(), @import) are blocked.
        </p>
        <Textarea
          rows={7}
          value={branding.customCss}
          maxLength={WORKSPACE_FORM_CUSTOM_CSS_MAX}
          spellCheck={false}
          className="font-mono text-xs"
          placeholder={`.ozer-form-title { letter-spacing: 0.02em; }\n.ozer-form-submit { text-transform: uppercase; }`}
          onChange={(event) => onBranding({ customCss: event.target.value })}
          data-test="form-custom-css"
        />
        {cssError ? (
          <p className="text-xs text-red-600" role="alert">
            {cssError}
          </p>
        ) : null}
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
