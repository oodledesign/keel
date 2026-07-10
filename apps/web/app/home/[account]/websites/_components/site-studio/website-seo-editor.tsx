'use client';

import { useMemo, useState, useTransition } from 'react';

import { Plus, Sparkles, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  emptyWebsiteSeoPageFields,
  type WebsiteSeoPageFields,
  type WebsiteSitemapPage,
} from '~/lib/websites/planning-types';

import {
  generateWebsiteSeoPage,
  saveWebsiteSeoPage,
} from '../../_lib/server/site-studio-actions';

const inputClass =
  'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[var(--workspace-shell-text)]">{label}</Label>
      {hint ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

export function WebsiteSeoEditor({
  accountId,
  websiteId,
  sitemap,
  initialSeoPages,
  canEdit,
}: {
  accountId: string;
  websiteId: string;
  sitemap: WebsiteSitemapPage[];
  initialSeoPages: Record<string, WebsiteSeoPageFields>;
  canEdit: boolean;
}) {
  const [seoPages, setSeoPages] = useState(initialSeoPages);
  const [activePageId, setActivePageId] = useState<string | null>(
    sitemap[0]?.id ?? null,
  );
  const [isSaving, startSaving] = useTransition();
  const [isGenerating, startGenerating] = useTransition();

  const activePage = useMemo(
    () => sitemap.find((page) => page.id === activePageId) ?? null,
    [activePageId, sitemap],
  );

  const fields = useMemo(
    () =>
      activePageId
        ? (seoPages[activePageId] ?? emptyWebsiteSeoPageFields())
        : emptyWebsiteSeoPageFields(),
    [activePageId, seoPages],
  );

  function patch(update: Partial<WebsiteSeoPageFields>) {
    if (!activePageId) return;
    setSeoPages((current) => ({
      ...current,
      [activePageId]: {
        ...(current[activePageId] ?? emptyWebsiteSeoPageFields()),
        ...update,
      },
    }));
  }

  function save() {
    if (!activePageId) return;
    startSaving(async () => {
      try {
        await saveWebsiteSeoPage({
          accountId,
          websiteId,
          pageId: activePageId,
          fields: seoPages[activePageId] ?? emptyWebsiteSeoPageFields(),
        });
        toast.success('Search fields saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save SEO fields',
        );
      }
    });
  }

  function generate() {
    if (!activePageId) return;
    startGenerating(async () => {
      try {
        const generated = await generateWebsiteSeoPage({
          accountId,
          websiteId,
          pageId: activePageId,
        });
        setSeoPages((current) => ({ ...current, [activePageId]: generated }));
        toast.success('Search fields drafted — review before export');
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not generate SEO fields',
        );
      }
    });
  }

  if (sitemap.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
        Build your sitemap first — search readiness is planned per page.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex flex-wrap gap-2 lg:flex-col">
        {sitemap.map((page) => {
          const hasFields = Boolean(
            seoPages[page.id]?.primaryKeyword || seoPages[page.id]?.title,
          );
          return (
            <button
              key={page.id}
              type="button"
              onClick={() => setActivePageId(page.id)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                activePageId === page.id
                  ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
                  : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
              )}
            >
              <span className="truncate">{page.title}</span>
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  hasFields ? 'bg-emerald-400' : 'bg-[var(--workspace-shell-text-muted)]/40',
                )}
              />
            </button>
          );
        })}
      </div>

      {activePage ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                {activePage.title} <span className="text-[var(--workspace-shell-text-muted)]">/{activePage.slug}</span>
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                SEO + local (GEO) + answer engine (AEO) fields for this page.
              </p>
            </div>
            {canEdit ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={generate}
                  disabled={isGenerating}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {isGenerating ? 'Drafting…' : 'Suggest for page'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]"
                  onClick={save}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Primary keyword">
              <Input
                value={fields.primaryKeyword}
                readOnly={!canEdit}
                onChange={(event) => patch({ primaryKeyword: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Secondary keywords" hint="Comma separated">
              <Input
                value={fields.secondaryKeywords}
                readOnly={!canEdit}
                onChange={(event) =>
                  patch({ secondaryKeywords: event.target.value })
                }
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Meta title" hint={`${fields.title.length}/60 characters`}>
              <Input
                value={fields.title}
                readOnly={!canEdit}
                onChange={(event) => patch({ title: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="H1">
              <Input
                value={fields.h1}
                readOnly={!canEdit}
                onChange={(event) => patch({ h1: event.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label="Meta description"
            hint={`${fields.metaDescription.length}/155 characters`}
          >
            <Textarea
              value={fields.metaDescription}
              readOnly={!canEdit}
              rows={2}
              onChange={(event) => patch({ metaDescription: event.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Heading outline" hint="One heading per line, prefixed H2: / H3:">
            <Textarea
              value={fields.headingOutline}
              readOnly={!canEdit}
              rows={4}
              onChange={(event) => patch({ headingOutline: event.target.value })}
              className={inputClass}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Internal links">
              <Textarea
                value={fields.internalLinks}
                readOnly={!canEdit}
                rows={3}
                onChange={(event) => patch({ internalLinks: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Image alt plan">
              <Textarea
                value={fields.imageAltPlan}
                readOnly={!canEdit}
                rows={3}
                onChange={(event) => patch({ imageAltPlan: event.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Schema.org types" hint="Comma separated, e.g. Organization, FAQPage, Service">
            <Input
              value={fields.schemaTypes.join(', ')}
              readOnly={!canEdit}
              onChange={(event) =>
                patch({
                  schemaTypes: event.target.value
                    .split(',')
                    .map((type) => type.trim())
                    .filter(Boolean),
                })
              }
              className={inputClass}
            />
          </Field>

          <Field
            label="Local SEO (GEO)"
            hint="Location pages, NAP consistency, service areas, Google Business cues"
          >
            <Textarea
              value={fields.localSeo}
              readOnly={!canEdit}
              rows={3}
              onChange={(event) => patch({ localSeo: event.target.value })}
              className={inputClass}
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-[var(--workspace-shell-text)]">
                  Answer blocks (AEO)
                </Label>
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  FAQ / entity answers LLMs can cite — exported as FAQPage JSON-LD
                  and llms.txt content.
                </p>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-[var(--workspace-shell-text-muted)]"
                  onClick={() =>
                    patch({
                      answerBlocks: [
                        ...fields.answerBlocks,
                        { question: '', answer: '' },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              ) : null}
            </div>
            {fields.answerBlocks.map((block, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-3"
              >
                <div className="flex items-start gap-2">
                  <Input
                    value={block.question}
                    readOnly={!canEdit}
                    placeholder="Question…"
                    onChange={(event) =>
                      patch({
                        answerBlocks: fields.answerBlocks.map((item, i) =>
                          i === index
                            ? { ...item, question: event.target.value }
                            : item,
                        ),
                      })
                    }
                    className={inputClass}
                  />
                  {canEdit ? (
                    <button
                      type="button"
                      className="mt-2.5 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                      onClick={() =>
                        patch({
                          answerBlocks: fields.answerBlocks.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <Textarea
                  value={block.answer}
                  readOnly={!canEdit}
                  rows={2}
                  placeholder="Citation-friendly answer…"
                  onChange={(event) =>
                    patch({
                      answerBlocks: fields.answerBlocks.map((item, i) =>
                        i === index ? { ...item, answer: event.target.value } : item,
                      ),
                    })
                  }
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          <Field
            label="Entity notes"
            hint="How this page fits the entity graph: org → services → locations"
          >
            <Textarea
              value={fields.entityNotes}
              readOnly={!canEdit}
              rows={2}
              onChange={(event) => patch({ entityNotes: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
