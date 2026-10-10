'use client';

import { useState } from 'react';

import { Monitor, RotateCcw, Smartphone } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { FormThemeStyle } from '~/components/workspace-forms/form-theme-style';
import type { BrandFonts } from '~/lib/brand/brand-fonts.shared';
import { brandFontStyle } from '~/lib/brand/brand-fonts.web';
import type { WorkspaceFormField } from '~/lib/workspace-forms/form-fields';
import {
  type WorkspaceFormTheme,
  brandPageGradientCss,
  resolveFormLogoUrl,
  resolveFormThemeColors,
} from '~/lib/workspace-forms/form-theme';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { PublicWorkspaceForm } from '../../../../share/form/[token]/_components/public-workspace-form';

type Props = {
  token: string;
  accountName: string;
  brand: {
    primary: string;
    accent: string;
    secondary: string | null;
    fonts?: BrandFonts | null;
  };
  brandLogoUrl: string | null;
  name: string;
  description: string;
  eventAddress: string;
  eventDate: string;
  eventTime: string;
  submitLabel: string;
  successMessage: string;
  fields: WorkspaceFormField[];
  theme: WorkspaceFormTheme;
};

/** Live, non-submitting preview of the public form using unsaved editor state. */
export function FormPreviewPanel({
  token,
  accountName,
  brand,
  brandLogoUrl,
  name,
  description,
  eventAddress,
  eventDate,
  eventTime,
  submitLabel,
  successMessage,
  fields,
  theme,
}: Props) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [resetKey, setResetKey] = useState(0);

  const colors = resolveFormThemeColors(theme, {
    primary_color: brand.primary,
    accent_color: brand.accent,
  });
  const gradient = theme.pageBackground === 'brand_gradient';
  const background = gradient
    ? brandPageGradientCss(colors.primaryColor)
    : theme.backgroundColor || brand.secondary || '#FBF6EC';
  const logoUrl = resolveFormLogoUrl(theme, brandLogoUrl);

  return (
    <section
      className={`${workspacePanelCard} space-y-3 p-4`}
      data-test="form-preview-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className={`text-base font-semibold ${workspaceText}`}>
            Live preview
          </h2>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Reflects unsaved changes. Submitting here sends nothing.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={device === 'desktop' ? 'secondary' : 'ghost'}
            onClick={() => setDevice('desktop')}
            aria-label="Desktop preview"
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === 'mobile' ? 'secondary' : 'ghost'}
            onClick={() => setDevice('mobile')}
            aria-label="Mobile preview"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setResetKey((key) => key + 1)}
            aria-label="Restart preview"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-[color:var(--workspace-shell-border)]">
        <main
          className={cn(
            'mx-auto flex min-h-[28rem] flex-col px-4 py-8 transition-[max-width]',
            device === 'mobile' ? 'max-w-[390px]' : 'max-w-full',
          )}
          style={{ background, ...brandFontStyle(brand.fonts) }}
          data-test="form-preview-canvas"
        >
          <FormThemeStyle theme={theme} />
          <PublicWorkspaceForm
            key={resetKey}
            preview
            token={token}
            accountName={accountName}
            formName={name || 'Untitled form'}
            description={description}
            eventAddress={eventAddress || null}
            eventDate={eventDate || null}
            eventTime={eventTime || null}
            layout={device === 'mobile' ? 'standard' : theme.layout}
            presentation={theme.presentation}
            submitLabel={submitLabel || 'Submit'}
            successMessage={
              successMessage || 'Thanks, we have received your details.'
            }
            fields={fields}
            logoUrl={logoUrl}
            showTitle={theme.showTitle}
            accentColor={colors.accentColor}
            primaryColor={colors.primaryColor}
            chromeOnDark={false}
            contentShell
          />
        </main>
      </div>
    </section>
  );
}
