'use client';

import type { WebsiteWireframeCopy } from '~/lib/websites/planning-types';
import { getWireframeCopySpec } from '~/lib/websites/wireframe-copy';

import {
  WfButton,
  WfField,
  WfImage,
  WfSectionFrame,
  WfText,
} from './wireframe-primitives';

type Props = {
  libraryKey: string | null | undefined;
  layout: string;
  copy: WebsiteWireframeCopy;
  canEdit: boolean;
  onSlotChange: (key: string, value: string) => void;
  onItemSlotChange: (itemId: string, key: string, value: string) => void;
};

function slot(copy: WebsiteWireframeCopy, key: string) {
  return copy.slots[key] ?? '';
}

function items(copy: WebsiteWireframeCopy) {
  return copy.items ?? [];
}

export function WireframeLibrarySection({
  libraryKey,
  layout,
  copy,
  canEdit,
  onSlotChange,
  onItemSlotChange,
}: Props) {
  const key = libraryKey ?? 'custom';

  switch (key) {
    case 'nav-standard':
      return (
        <WfSectionFrame padded={false} className="px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WfText
              value={slot(copy, 'logo')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('logo', v)}
              className="text-sm font-semibold"
            />
            <div className="flex flex-wrap items-center gap-4">
              {(['link1', 'link2', 'link3', 'link4'] as const).map((linkKey) => (
                <WfText
                  key={linkKey}
                  value={slot(copy, linkKey)}
                  canEdit={canEdit}
                  onChange={(v) => onSlotChange(linkKey, v)}
                  className="text-sm text-[#6b6b6b]"
                />
              ))}
              <WfButton
                value={slot(copy, 'cta')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('cta', v)}
              />
            </div>
          </div>
        </WfSectionFrame>
      );

    case 'hero-split':
      return (
        <WfSectionFrame>
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div className="space-y-4">
              <WfText
                value={slot(copy, 'eyebrow')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('eyebrow', v)}
                className="text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]"
              />
              <WfText
                value={slot(copy, 'headline')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('headline', v)}
                className="text-3xl font-semibold leading-tight md:text-4xl"
              />
              <WfText
                value={slot(copy, 'subheadline')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('subheadline', v)}
                multiline
                rows={3}
                className="text-sm leading-relaxed text-[#6b6b6b]"
              />
              <div className="flex flex-wrap gap-2">
                <WfButton
                  value={slot(copy, 'primaryCta')}
                  canEdit={canEdit}
                  onChange={(v) => onSlotChange('primaryCta', v)}
                />
                <WfButton
                  value={slot(copy, 'secondaryCta')}
                  canEdit={canEdit}
                  onChange={(v) => onSlotChange('secondaryCta', v)}
                  variant="secondary"
                />
              </div>
            </div>
            <WfImage className="min-h-48 w-full md:min-h-64" />
          </div>
        </WfSectionFrame>
      );

    case 'hero-centered':
      return (
        <WfSectionFrame className="relative">
          <WfImage className="absolute inset-0 min-h-full rounded-none border-0 opacity-40" label="Background" />
          <div className="relative mx-auto max-w-2xl space-y-4 py-10 text-center">
            <WfText
              value={slot(copy, 'eyebrow')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('eyebrow', v)}
              className="text-center text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]"
            />
            <WfText
              value={slot(copy, 'headline')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('headline', v)}
              className="text-center text-3xl font-semibold leading-tight md:text-4xl"
            />
            <WfText
              value={slot(copy, 'subheadline')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('subheadline', v)}
              multiline
              rows={2}
              className="text-center text-sm leading-relaxed text-[#6b6b6b]"
            />
            <div className="flex justify-center">
              <WfButton
                value={slot(copy, 'primaryCta')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('primaryCta', v)}
              />
            </div>
          </div>
        </WfSectionFrame>
      );

    case 'hero-form':
      return (
        <WfSectionFrame>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <WfText
                value={slot(copy, 'headline')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('headline', v)}
                className="text-3xl font-semibold leading-tight"
              />
              <WfText
                value={slot(copy, 'subheadline')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('subheadline', v)}
                multiline
                rows={3}
                className="text-sm text-[#6b6b6b]"
              />
            </div>
            <div className="space-y-3 rounded-lg border border-[#d4d4d4] bg-white p-4">
              <WfField
                label={slot(copy, 'field1')}
                canEdit={canEdit}
                onLabelChange={(v) => onSlotChange('field1', v)}
              />
              <WfField
                label={slot(copy, 'field2')}
                canEdit={canEdit}
                onLabelChange={(v) => onSlotChange('field2', v)}
              />
              <WfField
                label={slot(copy, 'field3')}
                canEdit={canEdit}
                onLabelChange={(v) => onSlotChange('field3', v)}
              />
              <WfButton
                value={slot(copy, 'submit')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('submit', v)}
                className="w-full"
              />
            </div>
          </div>
        </WfSectionFrame>
      );

    case 'logo-cloud':
      return (
        <WfSectionFrame>
          <div className="space-y-5">
            <WfText
              value={slot(copy, 'eyebrow')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('eyebrow', v)}
              className="text-center text-xs font-semibold uppercase tracking-wide text-[#6b6b6b]"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {items(copy).map((item) => (
                <div
                  key={item.id}
                  className="flex h-16 items-center justify-center rounded-md border border-dashed border-[#c4c4c4] bg-[#e8e8e8] px-2"
                >
                  <WfText
                    value={item.slots.name ?? ''}
                    canEdit={canEdit}
                    onChange={(v) => onItemSlotChange(item.id, 'name', v)}
                    className="text-center text-xs font-medium text-[#8a8a8a]"
                  />
                </div>
              ))}
            </div>
          </div>
        </WfSectionFrame>
      );

    case 'features-grid':
    case 'services-cards':
    case 'process-steps':
      return (
        <WfSectionFrame>
          <div className="mb-6 space-y-2 text-center">
            <WfText
              value={slot(copy, 'heading')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('heading', v)}
              className="text-2xl font-semibold"
            />
            <WfText
              value={slot(copy, 'body')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('body', v)}
              multiline
              rows={2}
              className="mx-auto max-w-xl text-sm text-[#6b6b6b]"
            />
          </div>
          <div
            className={
              key === 'process-steps'
                ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
                : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
            }
          >
            {items(copy).map((item, index) => (
              <div
                key={item.id}
                className="space-y-2 rounded-lg border border-[#d4d4d4] bg-white p-4"
              >
                {key === 'process-steps' ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8e8e8] text-xs font-semibold">
                    {index + 1}
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-md bg-[#e8e8e8]" />
                )}
                <WfText
                  value={item.slots.title ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'title', v)}
                  className="text-base font-semibold"
                />
                <WfText
                  value={item.slots.body ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'body', v)}
                  multiline
                  rows={3}
                  className="text-sm text-[#6b6b6b]"
                />
                {key === 'services-cards' ? (
                  <WfButton
                    value={item.slots.cta ?? ''}
                    canEdit={canEdit}
                    onChange={(v) => onItemSlotChange(item.id, 'cta', v)}
                    variant="secondary"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </WfSectionFrame>
      );

    case 'split-content':
      return (
        <WfSectionFrame>
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <WfImage className="min-h-44 w-full" />
            <div className="space-y-3">
              <WfText
                value={slot(copy, 'heading')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('heading', v)}
                className="text-2xl font-semibold"
              />
              <WfText
                value={slot(copy, 'body')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('body', v)}
                multiline
                rows={4}
                className="text-sm leading-relaxed text-[#6b6b6b]"
              />
              <WfButton
                value={slot(copy, 'cta')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('cta', v)}
                variant="secondary"
              />
            </div>
          </div>
        </WfSectionFrame>
      );

    case 'stats-band':
      return (
        <WfSectionFrame>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items(copy).map((item) => (
              <div key={item.id} className="space-y-1 text-center">
                <WfText
                  value={item.slots.stat ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'stat', v)}
                  className="text-3xl font-semibold"
                />
                <WfText
                  value={item.slots.label ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'label', v)}
                  className="text-sm text-[#6b6b6b]"
                />
              </div>
            ))}
          </div>
        </WfSectionFrame>
      );

    case 'testimonials-cards':
      return (
        <WfSectionFrame>
          <WfText
            value={slot(copy, 'heading')}
            canEdit={canEdit}
            onChange={(v) => onSlotChange('heading', v)}
            className="mb-6 text-center text-2xl font-semibold"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {items(copy).map((item) => (
              <div
                key={item.id}
                className="space-y-3 rounded-lg border border-[#d4d4d4] bg-white p-4"
              >
                <WfText
                  value={item.slots.quote ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'quote', v)}
                  multiline
                  rows={4}
                  className="text-sm italic leading-relaxed"
                />
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-[#e8e8e8]" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <WfText
                      value={item.slots.name ?? ''}
                      canEdit={canEdit}
                      onChange={(v) => onItemSlotChange(item.id, 'name', v)}
                      className="text-sm font-semibold"
                    />
                    <WfText
                      value={item.slots.role ?? ''}
                      canEdit={canEdit}
                      onChange={(v) => onItemSlotChange(item.id, 'role', v)}
                      className="text-xs text-[#6b6b6b]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </WfSectionFrame>
      );

    case 'case-studies':
    case 'blog-grid':
      return (
        <WfSectionFrame>
          <div className="mb-6 space-y-2">
            <WfText
              value={slot(copy, 'heading')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('heading', v)}
              className="text-2xl font-semibold"
            />
            {key === 'case-studies' ? (
              <WfText
                value={slot(copy, 'body')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('body', v)}
                multiline
                rows={2}
                className="text-sm text-[#6b6b6b]"
              />
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {items(copy).map((item) => (
              <div key={item.id} className="overflow-hidden rounded-lg border border-[#d4d4d4] bg-white">
                <WfImage className="h-32 w-full rounded-none border-0 border-b border-[#d4d4d4]" />
                <div className="space-y-2 p-4">
                  <WfText
                    value={item.slots.title ?? ''}
                    canEdit={canEdit}
                    onChange={(v) => onItemSlotChange(item.id, 'title', v)}
                    className="text-base font-semibold"
                  />
                  <WfText
                    value={
                      item.slots.outcome ?? item.slots.meta ?? ''
                    }
                    canEdit={canEdit}
                    onChange={(v) =>
                      onItemSlotChange(
                        item.id,
                        key === 'case-studies' ? 'outcome' : 'meta',
                        v,
                      )
                    }
                    multiline
                    rows={2}
                    className="text-sm text-[#6b6b6b]"
                  />
                </div>
              </div>
            ))}
          </div>
        </WfSectionFrame>
      );

    case 'team-grid':
      return (
        <WfSectionFrame>
          <WfText
            value={slot(copy, 'heading')}
            canEdit={canEdit}
            onChange={(v) => onSlotChange('heading', v)}
            className="mb-6 text-center text-2xl font-semibold"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items(copy).map((item) => (
              <div key={item.id} className="space-y-2 text-center">
                <WfImage className="mx-auto h-28 w-28 rounded-full" label="Photo" />
                <WfText
                  value={item.slots.name ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'name', v)}
                  className="text-sm font-semibold"
                />
                <WfText
                  value={item.slots.role ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'role', v)}
                  className="text-xs text-[#6b6b6b]"
                />
                <WfText
                  value={item.slots.bio ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'bio', v)}
                  multiline
                  rows={2}
                  className="text-xs text-[#6b6b6b]"
                />
              </div>
            ))}
          </div>
        </WfSectionFrame>
      );

    case 'pricing-table':
      return (
        <WfSectionFrame>
          <WfText
            value={slot(copy, 'heading')}
            canEdit={canEdit}
            onChange={(v) => onSlotChange('heading', v)}
            className="mb-6 text-center text-2xl font-semibold"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {items(copy).map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-[#d4d4d4] bg-white p-5"
              >
                <WfText
                  value={item.slots.name ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'name', v)}
                  className="text-sm font-semibold uppercase tracking-wide text-[#6b6b6b]"
                />
                <WfText
                  value={item.slots.price ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'price', v)}
                  className="text-3xl font-semibold"
                />
                <WfText
                  value={item.slots.features ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'features', v)}
                  multiline
                  rows={4}
                  className="flex-1 text-sm leading-relaxed text-[#6b6b6b]"
                />
                <WfButton
                  value={item.slots.cta ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'cta', v)}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </WfSectionFrame>
      );

    case 'faq-accordion':
      return (
        <WfSectionFrame>
          <WfText
            value={slot(copy, 'heading')}
            canEdit={canEdit}
            onChange={(v) => onSlotChange('heading', v)}
            className="mb-6 text-2xl font-semibold"
          />
          <div className="space-y-3">
            {items(copy).map((item) => (
              <div
                key={item.id}
                className="space-y-2 rounded-lg border border-[#d4d4d4] bg-white p-4"
              >
                <WfText
                  value={item.slots.question ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'question', v)}
                  className="text-sm font-semibold"
                />
                <WfText
                  value={item.slots.answer ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'answer', v)}
                  multiline
                  rows={2}
                  className="text-sm text-[#6b6b6b]"
                />
              </div>
            ))}
          </div>
        </WfSectionFrame>
      );

    case 'cta-band':
      return (
        <WfSectionFrame className="bg-[#e8e8e8]">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <WfText
              value={slot(copy, 'headline')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('headline', v)}
              className="text-2xl font-semibold md:text-3xl"
            />
            <WfText
              value={slot(copy, 'body')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('body', v)}
              multiline
              rows={2}
              className="text-sm text-[#6b6b6b]"
            />
            <div className="flex justify-center">
              <WfButton
                value={slot(copy, 'cta')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('cta', v)}
              />
            </div>
          </div>
        </WfSectionFrame>
      );

    case 'contact-form':
      return (
        <WfSectionFrame>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <WfText
                value={slot(copy, 'heading')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('heading', v)}
                className="text-2xl font-semibold"
              />
              <WfText
                value={slot(copy, 'body')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('body', v)}
                multiline
                rows={2}
                className="text-sm text-[#6b6b6b]"
              />
              <div className="space-y-1 pt-2 text-sm text-[#6b6b6b]">
                <WfText
                  value={slot(copy, 'address')}
                  canEdit={canEdit}
                  onChange={(v) => onSlotChange('address', v)}
                />
                <WfText
                  value={slot(copy, 'phone')}
                  canEdit={canEdit}
                  onChange={(v) => onSlotChange('phone', v)}
                />
                <WfText
                  value={slot(copy, 'email')}
                  canEdit={canEdit}
                  onChange={(v) => onSlotChange('email', v)}
                />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border border-[#d4d4d4] bg-white p-4">
              <WfField
                label={slot(copy, 'field1')}
                canEdit={canEdit}
                onLabelChange={(v) => onSlotChange('field1', v)}
              />
              <WfField
                label={slot(copy, 'field2')}
                canEdit={canEdit}
                onLabelChange={(v) => onSlotChange('field2', v)}
              />
              <WfField
                label={slot(copy, 'field3')}
                canEdit={canEdit}
                onLabelChange={(v) => onSlotChange('field3', v)}
              />
              <WfButton
                value={slot(copy, 'submit')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('submit', v)}
                className="w-full"
              />
            </div>
          </div>
        </WfSectionFrame>
      );

    case 'map-locations':
      return (
        <WfSectionFrame>
          <div className="grid gap-6 md:grid-cols-2">
            <WfImage className="min-h-52 w-full" label="Map" />
            <div className="space-y-3">
              <WfText
                value={slot(copy, 'heading')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('heading', v)}
                className="text-2xl font-semibold"
              />
              <WfText
                value={slot(copy, 'address')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('address', v)}
                className="text-sm"
              />
              <WfText
                value={slot(copy, 'hours')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('hours', v)}
                multiline
                rows={2}
                className="text-sm text-[#6b6b6b]"
              />
              <WfText
                value={slot(copy, 'locations')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('locations', v)}
                multiline
                rows={3}
                className="text-sm text-[#6b6b6b]"
              />
            </div>
          </div>
        </WfSectionFrame>
      );

    case 'gallery':
      return (
        <WfSectionFrame>
          <WfText
            value={slot(copy, 'heading')}
            canEdit={canEdit}
            onChange={(v) => onSlotChange('heading', v)}
            className="mb-6 text-2xl font-semibold"
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {items(copy).map((item) => (
              <div key={item.id} className="space-y-1">
                <WfImage className="aspect-[4/3] w-full" />
                <WfText
                  value={item.slots.caption ?? ''}
                  canEdit={canEdit}
                  onChange={(v) => onItemSlotChange(item.id, 'caption', v)}
                  className="text-xs text-[#6b6b6b]"
                />
              </div>
            ))}
          </div>
        </WfSectionFrame>
      );

    case 'video-feature':
      return (
        <WfSectionFrame>
          <div className="mx-auto max-w-3xl space-y-4">
            <WfText
              value={slot(copy, 'heading')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('heading', v)}
              className="text-center text-2xl font-semibold"
            />
            <WfText
              value={slot(copy, 'body')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('body', v)}
              multiline
              rows={2}
              className="text-center text-sm text-[#6b6b6b]"
            />
            <WfImage className="aspect-video w-full" label="Video" />
          </div>
        </WfSectionFrame>
      );

    case 'footer-standard':
      return (
        <WfSectionFrame className="bg-[#e8e8e8]">
          <div className="grid gap-6 md:grid-cols-4">
            <div className="space-y-2 md:col-span-1">
              <WfText
                value={slot(copy, 'brand')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('brand', v)}
                className="text-base font-semibold"
              />
              <WfText
                value={slot(copy, 'blurb')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('blurb', v)}
                multiline
                rows={2}
                className="text-sm text-[#6b6b6b]"
              />
            </div>
            <div className="space-y-2">
              <WfText
                value={slot(copy, 'col1Title')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('col1Title', v)}
                className="text-xs font-semibold uppercase tracking-wide"
              />
              <WfText
                value={slot(copy, 'col1Links')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('col1Links', v)}
                multiline
                rows={3}
                className="text-sm text-[#6b6b6b]"
              />
            </div>
            <div className="space-y-2">
              <WfText
                value={slot(copy, 'col2Title')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('col2Title', v)}
                className="text-xs font-semibold uppercase tracking-wide"
              />
              <WfText
                value={slot(copy, 'col2Links')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('col2Links', v)}
                multiline
                rows={3}
                className="text-sm text-[#6b6b6b]"
              />
            </div>
            <div className="space-y-2">
              <WfText
                value={slot(copy, 'contact')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('contact', v)}
                className="text-sm"
              />
              <WfText
                value={slot(copy, 'legal')}
                canEdit={canEdit}
                onChange={(v) => onSlotChange('legal', v)}
                className="text-xs text-[#6b6b6b]"
              />
            </div>
          </div>
        </WfSectionFrame>
      );

    default:
      return (
        <GenericWireframe
          layout={layout}
          copy={copy}
          canEdit={canEdit}
          onSlotChange={onSlotChange}
        />
      );
  }
}

function GenericWireframe({
  layout,
  copy,
  canEdit,
  onSlotChange,
}: {
  layout: string;
  copy: WebsiteWireframeCopy;
  canEdit: boolean;
  onSlotChange: (key: string, value: string) => void;
}) {
  const spec = getWireframeCopySpec(null);

  if (layout === 'split') {
    return (
      <WfSectionFrame>
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-3">
            <WfText
              value={slot(copy, 'heading') || spec.slots[0]?.defaultValue || ''}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('heading', v)}
              className="text-2xl font-semibold"
            />
            <WfText
              value={slot(copy, 'body')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('body', v)}
              multiline
              rows={4}
              className="text-sm text-[#6b6b6b]"
            />
            <WfButton
              value={slot(copy, 'cta')}
              canEdit={canEdit}
              onChange={(v) => onSlotChange('cta', v)}
              variant="secondary"
            />
          </div>
          <WfImage className="min-h-44 w-full" />
        </div>
      </WfSectionFrame>
    );
  }

  if (layout === 'cta') {
    return (
      <WfSectionFrame className="bg-[#e8e8e8]">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <WfText
            value={slot(copy, 'heading')}
            canEdit={canEdit}
            onChange={(v) => onSlotChange('heading', v)}
            className="text-xl font-semibold"
          />
          <WfButton
            value={slot(copy, 'cta')}
            canEdit={canEdit}
            onChange={(v) => onSlotChange('cta', v)}
          />
        </div>
      </WfSectionFrame>
    );
  }

  return (
    <WfSectionFrame>
      <div className="space-y-3">
        <WfText
          value={slot(copy, 'heading')}
          canEdit={canEdit}
          onChange={(v) => onSlotChange('heading', v)}
          className="text-2xl font-semibold"
        />
        <WfText
          value={slot(copy, 'body')}
          canEdit={canEdit}
          onChange={(v) => onSlotChange('body', v)}
          multiline
          rows={3}
          className="text-sm text-[#6b6b6b]"
        />
        {layout === 'grid' || layout === 'cards' ? (
          <div className="grid grid-cols-3 gap-2 pt-2">
            <WfImage className="h-20" />
            <WfImage className="h-20" />
            <WfImage className="h-20" />
          </div>
        ) : null}
      </div>
    </WfSectionFrame>
  );
}
