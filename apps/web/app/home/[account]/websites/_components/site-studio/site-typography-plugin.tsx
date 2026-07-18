'use client';

import { useMemo, useTransition } from 'react';

import type { Plugin } from '@puckeditor/core';
import { Type } from 'lucide-react';

import { derivedHeadingSizes } from '@kit/site-blocks-core';
import { toast } from '@kit/ui/sonner';

import type {
  WebsiteStyleHeadingLevel,
  WebsiteStyleTokens,
  WebsiteStyleTypography,
} from '~/lib/websites/style-tokens';
import { emptyWebsiteStyleSystem } from '~/lib/websites/style-tokens';

import { saveWebsiteStyleSystem } from '../../_lib/server/site-studio-actions';
import { useSiteStyleLive } from './site-style-live-context';

type HeadingKey = 'h1' | 'h2' | 'h3';

export function HeadingControls({
  tokens,
  disabled,
  onChange,
}: {
  tokens: WebsiteStyleTokens;
  disabled?: boolean;
  onChange: (typography: WebsiteStyleTypography) => void;
}) {
  const derived = useMemo(() => derivedHeadingSizes(tokens), [tokens]);

  function patchHeading(level: HeadingKey, patch: WebsiteStyleHeadingLevel) {
    onChange({
      ...tokens.typography,
      headings: {
        ...tokens.typography.headings,
        [level]: {
          ...tokens.typography.headings[level],
          ...patch,
        },
      },
    });
  }

  return (
    <div className="space-y-4">
      {(['h1', 'h2', 'h3'] as const).map((level) => {
        const current = tokens.typography.headings[level] ?? {};
        const sizeValue = current.sizePx ?? derived[level];
        const weightValue =
          current.weight ?? tokens.typography.weights.bold ?? 700;

        return (
          <div
            key={level}
            className="space-y-2 rounded-md border border-[color:var(--workspace-shell-border,#ddd)] p-2"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--workspace-shell-text-muted,#666)]">
              {level}
            </p>
            <p
              className="truncate text-[var(--workspace-shell-text,#111)]"
              style={{
                fontFamily: `var(--sb-font-display, ${tokens.typography.displayFamily})`,
                fontSize: `${sizeValue}px`,
                fontWeight: weightValue,
                lineHeight: 1.15,
              }}
            >
              {level === 'h1'
                ? 'Heading one'
                : level === 'h2'
                  ? 'Heading two'
                  : 'Heading three'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[11px] text-[var(--workspace-shell-text-muted,#666)]">
                Size (px)
                <input
                  type="number"
                  min={10}
                  max={120}
                  disabled={disabled}
                  value={sizeValue}
                  className="w-full rounded border px-2 py-1 text-sm"
                  onChange={(event) =>
                    patchHeading(level, {
                      sizePx: Number(event.target.value) || derived[level],
                    })
                  }
                />
              </label>
              <label className="space-y-1 text-[11px] text-[var(--workspace-shell-text-muted,#666)]">
                Weight
                <input
                  type="number"
                  min={100}
                  max={900}
                  step={100}
                  disabled={disabled}
                  value={weightValue}
                  className="w-full rounded border px-2 py-1 text-sm"
                  onChange={(event) =>
                    patchHeading(level, {
                      weight: Number(event.target.value) || 700,
                    })
                  }
                />
              </label>
            </div>
            <button
              type="button"
              disabled={disabled}
              className="text-[11px] text-[var(--ozer-accent,#FF5C34)] underline-offset-2 hover:underline"
              onClick={() =>
                patchHeading(level, { sizePx: null, weight: null })
              }
            >
              Reset to type scale
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SiteTypographyPanel() {
  const live = useSiteStyleLive();
  const [isSaving, startSaving] = useTransition();

  if (!live) {
    return (
      <div className="p-3 text-xs text-[var(--workspace-shell-text-muted,#666)]">
        Typography controls are unavailable.
      </div>
    );
  }

  const { tokens, canEdit, onTokensChange, accountId, websiteId, styleBase } =
    live;

  function patchTypography(typography: WebsiteStyleTypography) {
    onTokensChange({ ...tokens, typography });
  }

  function save() {
    startSaving(async () => {
      try {
        const base = styleBase ?? emptyWebsiteStyleSystem();
        await saveWebsiteStyleSystem({
          accountId,
          websiteId,
          style: {
            ...base,
            tokens,
          },
        });
        toast.success('Typography saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save typography',
        );
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div>
        <p className="text-sm font-semibold text-[var(--workspace-shell-text,#111)]">
          Typography
        </p>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted,#666)]">
          Tune H1–H3 size and weight for this site. Changes apply live in the
          preview.
        </p>
      </div>

      <div className="space-y-2">
        <label className="space-y-1 text-[11px] text-[var(--workspace-shell-text-muted,#666)]">
          Display family
          <input
            type="text"
            disabled={!canEdit}
            value={tokens.typography.displayFamily}
            className="w-full rounded border px-2 py-1 text-sm"
            onChange={(event) =>
              patchTypography({
                ...tokens.typography,
                displayFamily: event.target.value,
              })
            }
          />
        </label>
        <label className="space-y-1 text-[11px] text-[var(--workspace-shell-text-muted,#666)]">
          Body family
          <input
            type="text"
            disabled={!canEdit}
            value={tokens.typography.bodyFamily}
            className="w-full rounded border px-2 py-1 text-sm"
            onChange={(event) =>
              patchTypography({
                ...tokens.typography,
                bodyFamily: event.target.value,
              })
            }
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <HeadingControls
          tokens={tokens}
          disabled={!canEdit}
          onChange={patchTypography}
        />
      </div>

      {canEdit ? (
        <button
          type="button"
          disabled={isSaving}
          onClick={save}
          className="rounded-md bg-[var(--ozer-accent,#FF5C34)] px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save typography'}
        </button>
      ) : null}
    </div>
  );
}

/** Stable plugin — reads live tokens from SiteStyleLiveProvider. */
export function createSiteTypographyPlugin(): Plugin {
  return {
    name: 'site-typography',
    label: 'Type',
    icon: <Type size={16} />,
    render: () => <SiteTypographyPanel />,
  };
}
