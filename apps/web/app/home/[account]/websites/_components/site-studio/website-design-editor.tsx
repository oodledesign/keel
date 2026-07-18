'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';

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
  type WebsiteSitemapPage,
  type WebsiteStyleSystem,
  type WebsiteStyleTokens,
  type WebsiteWireframePage,
  emptyWebsiteStyleSystem,
} from '~/lib/websites/planning-types';

import {
  saveWebsiteStyleSystem,
  suggestWebsiteStyle,
} from '../../_lib/server/site-studio-actions';
import { HeadingControls } from './site-typography-plugin';
import { WireframePuckPage } from './wireframe-puck-page';

const inputClass =
  'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]';

function ColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[var(--workspace-shell-text)]">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888'}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-[color:var(--workspace-shell-border)] bg-transparent"
        />
        <Input
          value={value}
          readOnly={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'h-9 font-mono text-xs')}
        />
      </div>
    </div>
  );
}

export function WebsiteDesignEditor({
  accountId,
  websiteId,
  initialStyle,
  sitemap,
  wireframes,
  canEdit,
  onStyleChange,
}: {
  accountId: string;
  websiteId: string;
  initialStyle: WebsiteStyleSystem | null;
  sitemap: WebsiteSitemapPage[];
  wireframes: WebsiteWireframePage[];
  canEdit: boolean;
  onStyleChange?: (tokens: WebsiteStyleTokens) => void;
}) {
  const [style, setStyle] = useState<WebsiteStyleSystem>(
    initialStyle ?? emptyWebsiteStyleSystem(),
  );
  const [previewPageId, setPreviewPageId] = useState<string | null>(
    wireframes[0]?.pageId ?? sitemap[0]?.id ?? null,
  );
  const [isSaving, startSaving] = useTransition();
  const [isSuggesting, startSuggesting] = useTransition();

  useEffect(() => {
    onStyleChange?.(style.tokens);
  }, [onStyleChange, style.tokens]);

  const previewPage = useMemo(() => {
    const match =
      wireframes.find((page) => page.pageId === previewPageId) ?? null;
    if (match) return match;
    const sitemapPage = sitemap.find((page) => page.id === previewPageId);
    if (!sitemapPage) return null;
    return {
      id: sitemapPage.id,
      pageId: sitemapPage.id,
      title: sitemapPage.title,
      sections: sitemapPage.sections.map((section) => ({
        id: section.id,
        sitemapSectionId: section.id,
        title: section.title,
        layout: 'full' as const,
        contentNotes: section.description,
        copyOutline: section.description,
        libraryKey: null,
        layoutPreset: null,
      })),
    } satisfies WebsiteWireframePage;
  }, [previewPageId, sitemap, wireframes]);

  function patchTokens(update: Partial<WebsiteStyleTokens>) {
    setStyle((current) => ({
      ...current,
      tokens: { ...current.tokens, ...update },
    }));
  }

  function patchColors(update: Partial<WebsiteStyleTokens['colors']>) {
    setStyle((current) => ({
      ...current,
      tokens: {
        ...current.tokens,
        colors: { ...current.tokens.colors, ...update },
      },
    }));
  }

  function patchNeutral(index: number, value: string) {
    setStyle((current) => {
      const neutrals = [...current.tokens.colors.neutrals];
      neutrals[index] = value;
      return {
        ...current,
        tokens: {
          ...current.tokens,
          colors: { ...current.tokens.colors, neutrals },
        },
      };
    });
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
  const disabled = !canEdit || style.locked;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--workspace-shell-text)]/70">
          Directed wireframe+ — real blocks with your tokens. Lock when the
          brand system is ready for export.
        </p>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={suggest}
              disabled={isSuggesting || style.locked}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isSuggesting ? 'Suggesting…' : 'Suggest style system'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={style.locked ? 'secondary' : 'outline'}
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
            <Button
              type="button"
              size="sm"
              onClick={() => save()}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField
              label="Primary"
              value={tokens.colors.primary}
              disabled={disabled}
              onChange={(value) => patchColors({ primary: value })}
            />
            <ColorField
              label="Secondary"
              value={tokens.colors.secondary}
              disabled={disabled}
              onChange={(value) => patchColors({ secondary: value })}
            />
            <ColorField
              label="Accent"
              value={tokens.colors.accent}
              disabled={disabled}
              onChange={(value) => patchColors({ accent: value })}
            />
          </div>

          <div>
            <Label className="text-[var(--workspace-shell-text)]">
              Neutrals ({tokens.colors.neutrals.length})
            </Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {tokens.colors.neutrals.map((neutral, index) => (
                <ColorField
                  key={`neutral-${index}`}
                  label={`N${index}`}
                  value={neutral}
                  disabled={disabled}
                  onChange={(value) => patchNeutral(index, value)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField
              label="Success"
              value={tokens.colors.success}
              disabled={disabled}
              onChange={(value) => patchColors({ success: value })}
            />
            <ColorField
              label="Warning"
              value={tokens.colors.warning}
              disabled={disabled}
              onChange={(value) => patchColors({ warning: value })}
            />
            <ColorField
              label="Danger"
              value={tokens.colors.danger}
              disabled={disabled}
              onChange={(value) => patchColors({ danger: value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]">
                Display family
              </Label>
              <Input
                value={tokens.typography.displayFamily}
                readOnly={disabled}
                onChange={(event) =>
                  patchTokens({
                    typography: {
                      ...tokens.typography,
                      displayFamily: event.target.value,
                    },
                  })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]">
                Body family
              </Label>
              <Input
                value={tokens.typography.bodyFamily}
                readOnly={disabled}
                onChange={(event) =>
                  patchTokens({
                    typography: {
                      ...tokens.typography,
                      bodyFamily: event.target.value,
                    },
                  })
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]">
                Type base (px)
              </Label>
              <Input
                type="number"
                value={tokens.typography.typeScale.base}
                readOnly={disabled}
                onChange={(event) =>
                  patchTokens({
                    typography: {
                      ...tokens.typography,
                      typeScale: {
                        ...tokens.typography.typeScale,
                        base: Number(event.target.value) || 16,
                      },
                    },
                  })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]">
                Type ratio
              </Label>
              <Input
                type="number"
                step="0.01"
                value={tokens.typography.typeScale.ratio}
                readOnly={disabled}
                onChange={(event) =>
                  patchTokens({
                    typography: {
                      ...tokens.typography,
                      typeScale: {
                        ...tokens.typography.typeScale,
                        ratio: Number(event.target.value) || 1.25,
                      },
                    },
                  })
                }
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]">
                Button style
              </Label>
              <Select
                value={tokens.buttons.style}
                onValueChange={(value) =>
                  patchTokens({
                    buttons: {
                      style: value as WebsiteStyleTokens['buttons']['style'],
                    },
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pill">Pill</SelectItem>
                  <SelectItem value="rounded">Rounded</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[var(--workspace-shell-text)]">
              Heading sizes (H1–H3)
            </Label>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Leave blank to follow the type scale, or set explicit pixel sizes
              and weights. Also editable from the Type tab in the page editor.
            </p>
            <HeadingControls
              tokens={tokens}
              disabled={disabled}
              onChange={(typography) => patchTokens({ typography })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]">
                Spacing density
              </Label>
              <Select
                value={tokens.spacingDensity}
                onValueChange={(value) =>
                  patchTokens({
                    spacingDensity:
                      value as WebsiteStyleTokens['spacingDensity'],
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                  <SelectItem value="spacious">Spacious</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]">
                Photography direction
              </Label>
              <Input
                value={tokens.photographyDirection}
                readOnly={disabled}
                onChange={(event) =>
                  patchTokens({ photographyDirection: event.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[var(--workspace-shell-text)]">
                Moodboard
              </Label>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setStyle((current) => ({
                      ...current,
                      moodboard: [
                        ...current.moodboard,
                        { url: '', note: '', extractedPalette: [] },
                      ],
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
                Add reference URLs — AI uses these when suggesting tokens.
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
                            i === index
                              ? { ...item, url: event.target.value }
                              : item,
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
                            i === index
                              ? { ...item, note: event.target.value }
                              : item,
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
                            moodboard: current.moodboard.filter(
                              (_, i) => i !== index,
                            ),
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
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Live preview
            </p>
            <Select
              value={previewPageId ?? undefined}
              onValueChange={setPreviewPageId}
            >
              <SelectTrigger className={cn(inputClass, 'h-8 w-48 text-xs')}>
                <SelectValue placeholder="Page" />
              </SelectTrigger>
              <SelectContent>
                {(wireframes.length
                  ? wireframes.map((page) => ({
                      id: page.pageId,
                      title: page.title,
                    }))
                  : sitemap.map((page) => ({
                      id: page.id,
                      title: page.title,
                    }))
                ).map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {previewPage && previewPage.sections.length > 0 ? (
            <WireframePuckPage
              key={`${previewPage.pageId}-${tokens.colors.primary}-${tokens.buttons.style}-${tokens.spacingDensity}`}
              sections={previewPage.sections}
              wireframe={false}
              styleTokens={tokens}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
              Build a sitemap (and optionally generate wireframes) to preview
              tokens on real blocks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
