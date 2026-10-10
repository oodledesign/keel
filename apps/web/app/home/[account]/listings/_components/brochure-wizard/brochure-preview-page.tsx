'use client';

import type { CSSProperties } from 'react';

import { cn } from '@kit/ui/utils';

import type {
  BrochureLayoutId,
  BrochureOrientation,
  BrochurePage,
  BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { BROCHURE_LAYOUT_OPTIONS } from '~/lib/commercial/brochure-pdf/build-brochure-document';
import { resolveBrochurePlateLogo } from '~/lib/commercial/public-brochure.shared';

export type BrochureWizardBrand = {
  logoUrl: string | null;
  logoOnLightUrl?: string | null;
  logoOnDarkUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export function brochureLayoutLabel(id: BrochureLayoutId) {
  return BROCHURE_LAYOUT_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

function slotText(page: BrochurePage, key: string): string {
  const s = page.slots[key];
  return s?.type === 'text' ? s.text : '';
}

const FOCUS_POSITION = {
  top: 'center top',
  center: 'center center',
  bottom: 'center bottom',
} as const;

/** The slot's image URL and the CSS that mirrors the PDF's fit and focus. */
function slotImage(
  page: BrochurePage,
  key: string,
  drawingIds: ReadonlySet<string>,
): { url: string; style: CSSProperties } | null {
  const s = page.slots[key];
  if (s?.type !== 'image' || !s.url) return null;
  const fit = s.fit ?? 'auto';
  const whole =
    fit === 'whole' ||
    (fit === 'auto' && Boolean(s.mediaId && drawingIds.has(s.mediaId)));
  return {
    url: s.url,
    style: whole
      ? { objectFit: 'contain' }
      : {
          objectFit: 'cover',
          objectPosition: FOCUS_POSITION[s.focus ?? 'center'],
        },
  };
}

function SlotImg({
  image,
  className,
}: {
  image: { url: string; style: CSSProperties } | null;
  className?: string;
}) {
  if (!image) {
    return (
      <div
        className={cn(
          'h-full w-full bg-[var(--ozer-surface-panel-hover)]',
          className,
        )}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt=""
      className={cn('h-full w-full', className)}
      style={image.style}
    />
  );
}

/**
 * Approximate HTML preview of one brochure page for the review step. The real
 * PDF is checked in the preview step; this keeps editing fast.
 */
export function BrochurePreviewPage({
  page,
  orientation,
  templateId,
  brandName,
  brand,
  drawingIds,
}: {
  page: BrochurePage;
  orientation: BrochureOrientation;
  templateId: BrochureTemplateId;
  brandName: string;
  brand: BrochureWizardBrand;
  drawingIds: ReadonlySet<string>;
}) {
  const primary = brand.primaryColor || 'var(--ozer-plum-900)';
  const accent = brand.accentColor || 'var(--ozer-coral-500)';
  const paper = 'var(--ozer-cream-50)';
  const plateLogo = resolveBrochurePlateLogo(brand);
  const landscape = orientation === 'landscape';
  const title =
    slotText(page, 'title') ||
    slotText(page, 'address') ||
    brochureLayoutLabel(page.layoutId);
  const image = (key: string) => slotImage(page, key, drawingIds);

  const frameClass = cn(
    'overflow-hidden rounded-md border border-[var(--workspace-shell-border)] bg-white shadow-sm',
    landscape ? 'aspect-[297/210]' : 'aspect-[210/297]',
  );

  if (page.layoutId === 'cover_hero_band') {
    const disposal = slotText(page, 'disposal');
    const bandPct =
      templateId === 'editorial' ? 26 : templateId === 'compact' ? 38 : 32;
    const badge = slotText(page, 'reducedBadge') ? (
      <span
        className="absolute top-2 left-2 px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-white uppercase"
        style={{ backgroundColor: accent }}
      >
        {slotText(page, 'reducedBadge')}
      </span>
    ) : null;
    const brandMark = plateLogo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={plateLogo}
        alt=""
        className={cn(
          'mb-1 w-auto object-contain object-left',
          landscape ? 'h-6 max-w-full' : 'h-5 max-w-[40%]',
        )}
      />
    ) : (
      <p className="text-[9px] font-semibold tracking-wide uppercase opacity-80">
        {brandName}
      </p>
    );
    const facts = ['size', 'rent', 'price']
      .map((key) => slotText(page, key))
      .filter(Boolean)
      .map((line) => (
        <p key={line} className="text-[10px] font-semibold">
          {line}
        </p>
      ));

    return (
      <div className={frameClass}>
        <div className={cn('flex h-full', landscape ? '' : 'flex-col')}>
          <div
            className="relative min-h-0 flex-1"
            style={{ backgroundColor: primary }}
          >
            <SlotImg image={image('hero')} />
            {badge}
          </div>
          <div
            className="flex flex-col gap-1.5 p-3"
            style={{
              width: landscape ? `${bandPct}%` : undefined,
              minHeight: landscape ? undefined : '32%',
              backgroundColor: primary,
              color: paper,
              borderLeft:
                landscape && templateId === 'editorial'
                  ? `3px solid ${accent}`
                  : undefined,
            }}
          >
            {brandMark}
            {disposal ? (
              <p
                className="text-[9px] font-semibold uppercase"
                style={{ color: accent }}
              >
                {disposal}
              </p>
            ) : null}
            <p
              className={cn(
                'leading-tight font-semibold',
                landscape ? 'line-clamp-5 text-base' : 'line-clamp-2 text-sm',
              )}
            >
              {title}
            </p>
            {slotText(page, 'address') ? (
              <p className="text-[8px] leading-snug opacity-80">
                {slotText(page, 'address')}
              </p>
            ) : null}
            {facts}
          </div>
        </div>
      </div>
    );
  }

  if (
    page.layoutId === 'photo_full' ||
    page.layoutId === 'photo_grid_2' ||
    page.layoutId === 'photo_grid_3' ||
    page.layoutId === 'floorplan'
  ) {
    const keys =
      page.layoutId === 'photo_full'
        ? ['photo']
        : page.layoutId === 'floorplan'
          ? ['plan']
          : page.layoutId === 'photo_grid_2'
            ? ['photo1', 'photo2']
            : ['photo1', 'photo2', 'photo3'];

    return (
      <div className={frameClass}>
        <div
          className={cn(
            'grid h-full gap-1 bg-[var(--ozer-surface-panel-hover)] p-1.5',
            page.layoutId === 'photo_grid_2'
              ? landscape
                ? 'grid-cols-2'
                : 'grid-rows-2'
              : page.layoutId === 'photo_grid_3'
                ? 'grid-rows-[1.2fr_0.8fr]'
                : 'grid-rows-1',
          )}
        >
          {page.layoutId === 'photo_grid_3' ? (
            <>
              <SlotImg image={image('photo1')} className="bg-white" />
              <div className="grid min-h-0 grid-cols-2 gap-1">
                <SlotImg image={image('photo2')} className="bg-white" />
                <SlotImg image={image('photo3')} className="bg-white" />
              </div>
            </>
          ) : (
            keys.map((key) => {
              const img = image(key);
              return (
                <SlotImg
                  key={key}
                  image={
                    img && page.layoutId === 'floorplan'
                      ? { ...img, style: { objectFit: 'contain' } }
                      : img
                  }
                  className="min-h-0 bg-white"
                />
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (page.layoutId === 'facts_table') {
    const facts = page.slots.facts;
    const rows = facts?.type === 'facts' ? facts.rows.slice(0, 8) : [];
    const photos = ['photo1', 'photo2'].map(image).filter(Boolean);
    return (
      <div className={frameClass}>
        <div className="flex h-full gap-2 bg-white p-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div
              className="h-1 w-10 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <p className="text-xs font-semibold" style={{ color: primary }}>
              {title}
            </p>
            {rows.map((row, index) => (
              <div
                key={`${row.label}-${index}`}
                className="flex justify-between gap-2 border-b border-[var(--workspace-shell-border)] pb-0.5 text-[9px]"
              >
                <span className="text-[var(--workspace-shell-text-muted)]">
                  {row.label}
                </span>
                <span className="truncate text-[var(--workspace-shell-text)]">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          {photos.length > 0 ? (
            <div className="grid w-[42%] gap-1">
              {photos.map((photo, index) => (
                <SlotImg key={index} image={photo} className="min-h-0" />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (page.layoutId === 'contact') {
    const shopfront = image('shopfront');
    return (
      <div className={frameClass}>
        <div
          className={cn(
            'flex h-full bg-white p-3',
            landscape ? 'flex-row gap-3' : 'flex-col gap-2',
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold" style={{ color: primary }}>
              {title || 'Contact'}
            </p>
            {['branchName', 'branchAddress', 'branchPhone', 'branchEmail']
              .map((key) => slotText(page, key))
              .filter(Boolean)
              .map((line, index) => (
                <p
                  key={`${line}-${index}`}
                  className={cn(
                    'leading-snug whitespace-pre-line',
                    index === 0
                      ? 'text-[10px] font-medium text-[var(--workspace-shell-text)]'
                      : 'text-[9px] text-[var(--workspace-shell-text-muted)]',
                  )}
                >
                  {line}
                </p>
              ))}
            {shopfront ? (
              <SlotImg image={shopfront} className="mt-1 h-20 rounded-sm" />
            ) : null}
          </div>
          <div
            className={cn(
              'rounded-sm p-2 text-[9px]',
              landscape ? 'w-[45%]' : 'w-full',
            )}
            style={{ backgroundColor: primary, color: paper }}
          >
            Agents
          </div>
        </div>
      </div>
    );
  }

  if (page.layoutId === 'map_amenities') {
    return (
      <div className={frameClass}>
        <div
          className={cn(
            'flex h-full gap-2 bg-white p-3',
            landscape ? 'flex-row' : 'flex-col',
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold" style={{ color: primary }}>
              {title || 'Location'}
            </p>
            <p className="line-clamp-4 text-[10px] text-[var(--workspace-shell-text-muted)]">
              {slotText(page, 'body') || 'Map & amenities'}
            </p>
          </div>
          <div
            className={cn(
              'rounded-sm bg-[var(--ozer-surface-panel-hover)]',
              landscape ? 'w-[58%]' : 'h-[45%] w-full',
            )}
          />
        </div>
      </div>
    );
  }

  const body = slotText(page, 'body');
  const highlights = slotText(page, 'highlights').trim();
  return (
    <div className={frameClass}>
      <div className="flex h-full flex-col gap-2 bg-white p-3">
        <div
          className="h-1 w-10 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <p className="text-xs font-semibold" style={{ color: primary }}>
          {title}
        </p>
        {body ? (
          <p className="line-clamp-5 text-[10px] leading-relaxed text-[var(--workspace-shell-text-muted)]">
            {body}
          </p>
        ) : null}
        {highlights ? (
          <p className="line-clamp-4 text-[10px] whitespace-pre-line text-[var(--workspace-shell-text)]">
            {highlights}
          </p>
        ) : null}
        {!body && !highlights ? (
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)]">
            {brochureLayoutLabel(page.layoutId)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
