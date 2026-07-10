'use client';

import { useState, useTransition } from 'react';

import { Lock, LockOpen, Plus, Sparkles, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  emptyWebsiteStyleSystem,
  type WebsiteStyleSystem,
  type WebsiteStyleTokens,
} from '~/lib/websites/planning-types';

import {
  saveWebsiteStyleSystem,
  suggestWebsiteStyle,
} from '../../_lib/server/site-studio-actions';

const inputClass =
  'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]';

const COLOR_ROLES: Array<{
  key: keyof Pick<
    WebsiteStyleTokens,
    'canvas' | 'atmosphere' | 'accent' | 'contrast' | 'secondary'
  >;
  label: string;
  hint: string;
}> = [
  { key: 'canvas', label: 'Canvas', hint: 'Neutral base layer' },
  { key: 'atmosphere', label: 'Atmosphere', hint: 'Subtle backgrounds, mood' },
  { key: 'accent', label: 'Accent', hint: 'Buttons, highlights' },
  { key: 'contrast', label: 'Contrast', hint: 'Headings + body text' },
  { key: 'secondary', label: 'Secondary', hint: 'Support accents' },
];

export function WebsiteDesignEditor({
  accountId,
  websiteId,
  initialStyle,
  canEdit,
}: {
  accountId: string;
  websiteId: string;
  initialStyle: WebsiteStyleSystem | null;
  canEdit: boolean;
}) {
  const [style, setStyle] = useState<WebsiteStyleSystem>(
    initialStyle ?? emptyWebsiteStyleSystem(),
  );
  const [isSaving, startSaving] = useTransition();
  const [isSuggesting, startSuggesting] = useTransition();

  function patchTokens(update: Partial<WebsiteStyleTokens>) {
    setStyle((current) => ({
      ...current,
      tokens: { ...current.tokens, ...update },
    }));
  }

  function save(next?: WebsiteStyleSystem) {
    const payload = next ?? style;
    startSaving(async () => {
      try {
        await saveWebsiteStyleSystem({
          accountId,
          websiteId,
          style: payload,
        });
        toast.success('Style system saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save style',
        );
      }
    });
  }

  function suggest() {
    startSuggesting(async () => {
      try {
        const suggested = await suggestWebsiteStyle({ accountId, websiteId });
        setStyle(suggested);
        toast.success('Style direction suggested — adjust and lock it in');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not suggest style',
        );
      }
    });
  }

  function toggleLock() {
    const next = { ...style, locked: !style.locked };
    setStyle(next);
    save(next);
  }

  const { tokens } = style;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--workspace-shell-text)]/70">
          Style system for exports and prompts. Add moodboard references, let AI
          suggest a direction, then lock the tokens.
        </p>
        {canEdit ? (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={suggest}
              disabled={isSuggesting || style.locked}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isSuggesting ? 'Suggesting…' : 'Suggest from brief'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={style.locked ? 'secondary' : 'outline'}
              className={
                style.locked
                  ? undefined
                  : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]'
              }
              onClick={toggleLock}
            >
              {style.locked ? (
                <>
                  <LockOpen className="mr-2 h-4 w-4" />
                  Unlock tokens
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Lock tokens
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Live preview strip */}
      <div
        className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]"
        style={{ background: tokens.canvas }}
      >
        <div className="px-6 py-8">
          <p
            className="text-2xl font-semibold"
            style={{
              color: tokens.contrast,
              fontFamily: tokens.headingFont || undefined,
            }}
          >
            {tokens.headingFont || 'Heading font'} — directed, not generic
          </p>
          <p
            className="mt-2 max-w-xl text-sm"
            style={{
              color: tokens.contrast,
              opacity: 0.75,
              fontFamily: tokens.bodyFont || undefined,
            }}
          >
            {tokens.photographyDirection ||
              'Body copy preview. Photography direction appears here once set.'}
          </p>
          <span
            className="mt-4 inline-block px-5 py-2 text-sm font-medium"
            style={{
              background: tokens.accent,
              color: tokens.canvas,
              borderRadius:
                tokens.radius === 'sharp'
                  ? 0
                  : tokens.radius === 'round'
                    ? 999
                    : 8,
            }}
          >
            Primary action
          </span>
        </div>
        <div className="px-6 py-4" style={{ background: tokens.atmosphere }}>
          <p className="text-xs" style={{ color: tokens.contrast, opacity: 0.7 }}>
            Atmosphere section background
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {COLOR_ROLES.map((role) => (
          <div key={role.key} className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]">{role.label}</Label>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">{role.hint}</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(tokens[role.key]) ? tokens[role.key] : '#888888'}
                disabled={!canEdit || style.locked}
                onChange={(event) => patchTokens({ [role.key]: event.target.value })}
                className="h-9 w-9 shrink-0 cursor-pointer rounded border border-[color:var(--workspace-shell-border)] bg-transparent"
              />
              <Input
                value={tokens[role.key]}
                readOnly={!canEdit || style.locked}
                onChange={(event) => patchTokens({ [role.key]: event.target.value })}
                className={cn(inputClass, 'h-9 font-mono text-xs')}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]">Heading font</Label>
          <Input
            value={tokens.headingFont}
            readOnly={!canEdit || style.locked}
            onChange={(event) => patchTokens({ headingFont: event.target.value })}
            placeholder="e.g. Fraunces"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]">Body font</Label>
          <Input
            value={tokens.bodyFont}
            readOnly={!canEdit || style.locked}
            onChange={(event) => patchTokens({ bodyFont: event.target.value })}
            placeholder="e.g. Manrope"
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]">Type scale</Label>
          <Select
            value={tokens.typeScale}
            onValueChange={(value) =>
              patchTokens({ typeScale: value as WebsiteStyleTokens['typeScale'] })
            }
            disabled={!canEdit || style.locked}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="display">Display</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]">Radius</Label>
          <Select
            value={tokens.radius}
            onValueChange={(value) =>
              patchTokens({ radius: value as WebsiteStyleTokens['radius'] })
            }
            disabled={!canEdit || style.locked}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sharp">Sharp</SelectItem>
              <SelectItem value="soft">Soft</SelectItem>
              <SelectItem value="round">Round</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]">Spacing density</Label>
          <Select
            value={tokens.spacingDensity}
            onValueChange={(value) =>
              patchTokens({
                spacingDensity: value as WebsiteStyleTokens['spacingDensity'],
              })
            }
            disabled={!canEdit || style.locked}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tight">Tight</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="airy">Airy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]">
            Photography direction
          </Label>
          <Input
            value={tokens.photographyDirection}
            readOnly={!canEdit || style.locked}
            onChange={(event) =>
              patchTokens({ photographyDirection: event.target.value })
            }
            placeholder="e.g. Warm natural light, real team, no stocky handshakes"
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[var(--workspace-shell-text)]">Moodboard references</Label>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-[var(--workspace-shell-text-muted)]"
              onClick={() =>
                setStyle((current) => ({
                  ...current,
                  moodboard: [...current.moodboard, { url: '', note: '' }],
                }))
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add reference
            </Button>
          ) : null}
        </div>
        {style.moodboard.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Add reference URLs (sites, Are.na, Pinterest boards) — AI uses these
            when suggesting tokens.
          </p>
        ) : (
          <div className="space-y-2">
            {style.moodboard.map((ref, index) => (
              <div key={index} className="flex items-start gap-2">
                <Input
                  value={ref.url}
                  readOnly={!canEdit}
                  placeholder="https://…"
                  onChange={(event) =>
                    setStyle((current) => ({
                      ...current,
                      moodboard: current.moodboard.map((item, i) =>
                        i === index ? { ...item, url: event.target.value } : item,
                      ),
                    }))
                  }
                  className={cn(inputClass, 'max-w-xs')}
                />
                <Input
                  value={ref.note}
                  readOnly={!canEdit}
                  placeholder="What to take from it…"
                  onChange={(event) =>
                    setStyle((current) => ({
                      ...current,
                      moodboard: current.moodboard.map((item, i) =>
                        i === index ? { ...item, note: event.target.value } : item,
                      ),
                    }))
                  }
                  className={inputClass}
                />
                {canEdit ? (
                  <button
                    type="button"
                    className="mt-2.5 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                    onClick={() =>
                      setStyle((current) => ({
                        ...current,
                        moodboard: current.moodboard.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {canEdit ? (
        <Button type="button" onClick={() => save()} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save style system'}
        </Button>
      ) : null}

      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        Need full visual design? Export style tokens + wireframe outline for
        Figma from the Export tab — Site Studio deliberately stops at directed
        wireframes.
      </p>
    </div>
  );
}
