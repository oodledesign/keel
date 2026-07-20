'use client';

import { type CSSProperties, type ReactNode, useState } from 'react';

import { Monitor, Moon, Smartphone, Sun, Tablet } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  SIGNATURE_PREVIEW_DESKTOP_WIDTH_PX,
  SIGNATURE_PREVIEW_VIEWPORTS,
  type SignaturePreviewTheme,
  type SignaturePreviewViewport,
  resolveSignaturePreviewViewport,
  signaturePreviewLayoutWidthPx,
} from '~/lib/signatures/signature-preview-document';

export type { SignaturePreviewTheme, SignaturePreviewViewport };
export {
  SIGNATURE_PREVIEW_DESKTOP_WIDTH_PX,
  SIGNATURE_PREVIEW_VIEWPORTS,
  resolveSignaturePreviewViewport,
  signaturePreviewLayoutWidthPx,
};

const VIEWPORT_ICONS = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
} as const;

export function signaturePreviewViewportStyle(
  viewport: SignaturePreviewViewport,
): CSSProperties {
  return {
    maxWidth: `${signaturePreviewLayoutWidthPx(viewport)}px`,
    width: '100%',
  };
}

export type SignaturePreviewFrameContext = {
  viewport: SignaturePreviewViewport;
  layoutWidthPx: number;
  theme: SignaturePreviewTheme;
};

type ViewportControlsAppearance = 'workspace' | 'inbox';

export function SignaturePreviewViewportControls({
  viewport,
  onViewportChange,
  appearance = 'workspace',
  isDark = false,
  showLabels = true,
}: {
  viewport: SignaturePreviewViewport;
  onViewportChange: (viewport: SignaturePreviewViewport) => void;
  appearance?: ViewportControlsAppearance;
  isDark?: boolean;
  showLabels?: boolean;
}) {
  const inboxShell = isDark
    ? 'border-[#3a3a3c] bg-[#2c2c2e]'
    : 'border-[#e5e5ea] bg-[#f5f5f7]';
  const inboxActive = isDark ? 'bg-[#3a3a3c]' : 'bg-white';
  const inboxText = isDark ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]';

  return (
    <div
      className={cn(
        'inline-flex rounded-lg border p-0.5',
        appearance === 'workspace'
          ? 'border-[color:var(--workspace-shell-border)]'
          : inboxShell,
      )}
      role="group"
      aria-label="Preview viewport"
    >
      {SIGNATURE_PREVIEW_VIEWPORTS.map(({ id, label }) => {
        const Icon = VIEWPORT_ICONS[id];
        return (
          <Button
            key={id}
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              'h-8 gap-1.5 px-2.5',
              appearance === 'workspace' &&
                viewport === id &&
                'bg-[var(--workspace-shell-sidebar-accent)]',
              appearance === 'inbox' && inboxText,
              appearance === 'inbox' && viewport === id && inboxActive,
            )}
            onClick={() => onViewportChange(id)}
            title={`${label} width`}
            aria-pressed={viewport === id}
          >
            <Icon className="h-3.5 w-3.5" />
            {showLabels ? (
              <span className="hidden sm:inline">{label}</span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}

export function SignaturePreviewThemeControls({
  theme,
  onThemeChange,
  appearance = 'workspace',
  isDark = false,
}: {
  theme: SignaturePreviewTheme;
  onThemeChange: (theme: SignaturePreviewTheme) => void;
  appearance?: ViewportControlsAppearance;
  isDark?: boolean;
}) {
  const inboxShell = isDark
    ? 'border-[#3a3a3c] bg-[#2c2c2e]'
    : 'border-[#e5e5ea] bg-[#f5f5f7]';
  const inboxActive = isDark ? 'bg-[#3a3a3c]' : 'bg-white';
  const inboxText = isDark ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]';

  return (
    <div
      className={cn(
        'inline-flex rounded-lg border p-0.5',
        appearance === 'workspace'
          ? 'border-[color:var(--workspace-shell-border)]'
          : inboxShell,
      )}
      role="group"
      aria-label="Preview theme"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn(
          'h-8 gap-1.5 px-2.5',
          appearance === 'workspace' &&
            theme === 'light' &&
            'bg-[var(--workspace-shell-sidebar-accent)]',
          appearance === 'inbox' && inboxText,
          appearance === 'inbox' && theme === 'light' && inboxActive,
        )}
        onClick={() => onThemeChange('light')}
        title="Light inbox preview"
        aria-pressed={theme === 'light'}
      >
        <Sun className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Light</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn(
          'h-8 gap-1.5 px-2.5',
          appearance === 'workspace' &&
            theme === 'dark' &&
            'bg-[var(--workspace-shell-sidebar-accent)]',
          appearance === 'inbox' && inboxText,
          appearance === 'inbox' && theme === 'dark' && inboxActive,
        )}
        onClick={() => onThemeChange('dark')}
        title="Dark inbox preview"
        aria-pressed={theme === 'dark'}
      >
        <Moon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Dark</span>
      </Button>
    </div>
  );
}

export function SignaturePreviewFrame({
  theme,
  onThemeChange,
  showThemeToggle = true,
  defaultViewport = 'desktop',
  heightClassName = 'h-[420px]',
  toolbarExtra,
  children,
}: {
  theme?: SignaturePreviewTheme;
  onThemeChange?: (theme: SignaturePreviewTheme) => void;
  showThemeToggle?: boolean;
  defaultViewport?: SignaturePreviewViewport;
  /** Tailwind height class applied to the preview surface */
  heightClassName?: string;
  toolbarExtra?: ReactNode;
  children:
    | ReactNode
    | ((context: SignaturePreviewFrameContext) => ReactNode);
}) {
  const [viewport, setViewport] =
    useState<SignaturePreviewViewport>(defaultViewport);
  const active = resolveSignaturePreviewViewport(viewport);
  const resolvedTheme = theme ?? 'light';
  const layoutWidthPx = signaturePreviewLayoutWidthPx(viewport);
  const isDeviceViewport = active.id !== 'desktop';
  const previewContext: SignaturePreviewFrameContext = {
    viewport,
    layoutWidthPx,
    theme: resolvedTheme,
  };
  const previewContent =
    typeof children === 'function' ? children(previewContext) : children;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SignaturePreviewViewportControls
          viewport={viewport}
          onViewportChange={setViewport}
        />

        <div className="flex items-center gap-2">
          {toolbarExtra}
          {showThemeToggle && onThemeChange ? (
            <SignaturePreviewThemeControls
              theme={resolvedTheme}
              onThemeChange={onThemeChange}
            />
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)] p-3',
          resolvedTheme === 'light' ? 'bg-[#f5f5f7]' : 'bg-[#121214]',
        )}
      >
        <div
          className={cn(
            'mx-auto min-w-0 transition-[max-width] duration-200 ease-out',
            isDeviceViewport &&
              'overflow-hidden shadow-[0_12px_40px_rgba(42,23,32,0.12)]',
            active.id === 'mobile' &&
              'rounded-[1.75rem] border-[9px] border-[#1d1d1f]',
            active.id === 'tablet' &&
              'rounded-2xl border-[6px] border-[#1d1d1f]/90',
          )}
          style={signaturePreviewViewportStyle(viewport)}
        >
          <div
            className={cn(
              'min-w-0 overflow-x-auto',
              heightClassName,
              isDeviceViewport && 'rounded-[inherit]',
              resolvedTheme === 'light' ? 'bg-white' : 'bg-[#1c1c1e]',
            )}
          >
            {previewContent}
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Previewing at {layoutWidthPx}px ({active.label.toLowerCase()} layout
        width). Responsive signatures switch layouts near 480px — use Mobile to
        preview the stacked variant.
      </p>
    </div>
  );
}
