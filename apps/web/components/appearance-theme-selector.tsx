'use client';

import { useTheme } from 'next-themes';

import { Label } from '@kit/ui/label';
import { Button } from '@kit/ui/button';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const;

type ThemeValue = (typeof THEME_OPTIONS)[number]['value'];

export function AppearanceThemeSelector() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const active = (theme ?? 'system') as ThemeValue;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-base font-medium">Appearance</Label>
        <p className="text-muted-foreground text-sm">
          Choose light or dark mode. System follows your device setting.
          {resolvedTheme ? (
            <span className="text-muted-foreground/80"> Currently {resolvedTheme}.</span>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {THEME_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant="outline"
            size="sm"
            className={
              active === opt.value
                ? 'border-[var(--ozer-accent)]/60 bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]'
                : 'border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)]'
            }
            onClick={() => setTheme(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
