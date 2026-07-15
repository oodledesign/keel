'use client';

import { useState, type ReactNode } from 'react';

import { Monitor, Moon, Smartphone, Sun, Tablet } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

export type SignaturePreviewTheme = 'light' | 'dark';
export type SignaturePreviewViewport = 'mobile' | 'tablet' | 'desktop';

const VIEWPORTS: {
  id: SignaturePreviewViewport;
  label: string;
  widthPx: number | null;
  Icon: typeof Smartphone;
}[] = [
  { id: 'mobile', label: 'Mobile', widthPx: 375, Icon: Smartphone },
  { id: 'tablet', label: 'Tablet', widthPx: 768, Icon: Tablet },
  { id: 'desktop', label: 'Desktop', widthPx: null, Icon: Monitor },
];

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
  children: ReactNode;
}) {
  const [viewport, setViewport] =
    useState<SignaturePreviewViewport>(defaultViewport);
  const active = VIEWPORTS.find((item) => item.id === viewport) ?? VIEWPORTS[2]!;
  const resolvedTheme = theme ?? 'light';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-[color:var(--workspace-shell-border)] p-0.5">
          {VIEWPORTS.map(({ id, label, Icon }) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                'h-8 gap-1.5 px-2.5',
                viewport === id &&
                  'bg-[var(--workspace-shell-sidebar-accent)]',
              )}
              onClick={() => setViewport(id)}
              title={`${label} width`}
              aria-pressed={viewport === id}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {toolbarExtra}
          {showThemeToggle && onThemeChange ? (
            <div className="inline-flex rounded-lg border border-[color:var(--workspace-shell-border)] p-0.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'h-8 px-2',
                  resolvedTheme === 'light' &&
                    'bg-[var(--workspace-shell-sidebar-accent)]',
                )}
                onClick={() => onThemeChange('light')}
                title="Light inbox preview"
                aria-pressed={resolvedTheme === 'light'}
              >
                <Sun className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'h-8 px-2',
                  resolvedTheme === 'dark' &&
                    'bg-[var(--workspace-shell-sidebar-accent)]',
                )}
                onClick={() => onThemeChange('dark')}
                title="Dark inbox preview"
                aria-pressed={resolvedTheme === 'dark'}
              >
                <Moon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)] p-3',
          resolvedTheme === 'light' ? 'bg-white' : 'bg-[#1c1c1e]',
        )}
      >
        <div
          className={cn(
            'mx-auto transition-[max-width] duration-200 ease-out',
            heightClassName,
          )}
          style={{
            maxWidth: active.widthPx ? `${active.widthPx}px` : '100%',
            width: '100%',
          }}
        >
          {children}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {active.widthPx
          ? `Previewing at ${active.widthPx}px (${active.label.toLowerCase()} reading width).`
          : 'Previewing at full desktop width.'}
      </p>
    </div>
  );
}
