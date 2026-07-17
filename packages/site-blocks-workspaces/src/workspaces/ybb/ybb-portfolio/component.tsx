'use client';

import { useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';

import {
  YBB_DEFAULTS,
  YBB_DEFAULT_PORTFOLIO_TILTS,
} from '../defaults';
import { resolveYbbBackgroundStyle, ybbCtaClassName } from '../ybb-styles';

import '../ybb-buttons.css';
import './ybb-portfolio.css';
import {
  sanitizeTiltDegrees,
  useYbbPortfolioCarousel,
} from './use-ybb-portfolio-carousel';

export type YbbPortfolioSlide = {
  imageUrl?: string;
  imageAlt?: string;
  tilt?: string;
};

export type YbbPortfolioProps = {
  sectionId?: string;
  title?: string;
  backgroundToken?: string;
  backgroundColor?: string;
  slides?: YbbPortfolioSlide[];
  showArrows?: boolean;
  showDots?: boolean;
  autoplay?: boolean;
  autoplayMs?: number;
  showFooterCta?: boolean;
  footerCtaLabel?: string;
  footerCtaHref?: string;
  footerCtaVariant?: string;
};

function slideAlt(slide: YbbPortfolioSlide, index: number): string {
  if (slide.imageAlt?.trim()) {
    return slide.imageAlt.trim();
  }
  return `Bridal client portfolio image ${index + 1}`;
}

function slideTilt(slide: YbbPortfolioSlide, index: number): string {
  const preset = YBB_DEFAULT_PORTFOLIO_TILTS[index % YBB_DEFAULT_PORTFOLIO_TILTS.length];
  return sanitizeTiltDegrees(slide.tilt?.trim() ? slide.tilt : preset);
}

export function YbbPortfolio(props: YbbPortfolioProps) {
  const sectionId = props.sectionId ?? 'portfolio';
  const title = props.title ?? YBB_DEFAULTS.portfolioTitle;
  const slides = (props.slides ?? []).filter((slide) => slide.imageUrl?.trim());
  const showArrows = props.showArrows ?? true;
  const showDots = props.showDots ?? true;
  const autoplay = props.autoplay ?? true;
  const autoplayMs = props.autoplayMs ?? 3200;
  const showFooterCta = props.showFooterCta ?? true;
  const footerCtaLabel = props.footerCtaLabel ?? YBB_DEFAULTS.portfolioCtaLabel;
  const footerCtaHref = props.footerCtaHref ?? YBB_DEFAULTS.portfolioCtaHref;
  const footerCtaVariant = props.footerCtaVariant ?? 'primary';

  const stageRef = useRef<HTMLDivElement>(null);
  const slideCount = slides.length;

  useYbbPortfolioCarousel(stageRef, { slideCount, autoplay, autoplayMs });

  const sectionStyle = resolveYbbBackgroundStyle({
    backgroundToken: props.backgroundToken ?? 'atmosphere',
    backgroundColor: props.backgroundColor ?? '#F9DADA',
  }) as CSSProperties;

  const renderedSlides = useMemo(() => {
    if (slideCount === 0) {
      return null;
    }

    return [0, 1, 2].flatMap((clone) =>
      slides.map((slide, index) => {
        const isPrimaryClone = clone === 1;
        const isCurrent = isPrimaryClone && index === 0;

        return (
          <figure
            key={`${clone}-${index}`}
            className="ybbPortfolioItem"
            style={
              {
                ['--ybb-portfolio-tilt' as string]: slideTilt(slide, index),
              } as CSSProperties
            }
            role="listitem"
            data-ybb-portfolio-slide
            data-ybb-portfolio-index={index}
            data-ybb-portfolio-clone={clone}
            aria-hidden={isCurrent ? 'false' : 'true'}
          >
            <img
              src={slide.imageUrl}
              alt={isPrimaryClone ? slideAlt(slide, index) : ''}
              loading={isPrimaryClone && index < 3 ? 'eager' : 'lazy'}
              draggable={false}
            />
          </figure>
        );
      }),
    );
  }, [slideCount, slides]);

  return (
    <section
      id={sectionId || undefined}
      className="ybbPortfolio"
      style={sectionStyle}
      aria-labelledby={`${sectionId}-heading`}
    >
      <div className="ybbPortfolioHeader">
        <h2 className="ybbPortfolioTitle" id={`${sectionId}-heading`}>
          {title}
        </h2>
      </div>

      {slideCount === 0 ? (
        <p className="ybbPortfolioEmpty">
          Add client photos in the block settings to populate the carousel.
        </p>
      ) : (
        <div
          ref={stageRef}
          className="ybbPortfolioStage"
          data-ybb-portfolio-carousel
          data-ybb-portfolio-count={slideCount}
        >
          <div className="ybbPortfolioViewport">
            <div
              className="ybbPortfolioTrack"
              role="list"
              aria-label="Client photo gallery"
              data-ybb-portfolio-track
            >
              {renderedSlides}
            </div>
          </div>

          {showArrows ? (
            <>
              <button
                className="ybbPortfolioArrow ybbPortfolioArrowPrev"
                type="button"
                aria-label="Previous client photo"
                data-ybb-portfolio-prev
              >
                ←
              </button>
              <button
                className="ybbPortfolioArrow ybbPortfolioArrowNext"
                type="button"
                aria-label="Next client photo"
                data-ybb-portfolio-next
              >
                →
              </button>
            </>
          ) : null}
        </div>
      )}

      {slideCount > 0 && (showDots || showFooterCta) ? (
        <div className="ybbPortfolioFooter">
          {showDots ? (
            <div
              className="ybbPortfolioDots"
              role="tablist"
              aria-label="Gallery slides"
            >
              {slides.map((_, index) => (
                <button
                  key={index}
                  className={`ybbPortfolioDot${index === 0 ? ' ybbPortfolioDotActive' : ''}`}
                  type="button"
                  role="tab"
                  aria-label={`Go to photo ${index + 1}`}
                  aria-selected={index === 0 ? 'true' : 'false'}
                  data-ybb-portfolio-dot={index}
                />
              ))}
            </div>
          ) : null}
          {showFooterCta && footerCtaLabel ? (
            <a
              className={ybbCtaClassName(footerCtaVariant)}
              href={footerCtaHref || '#'}
            >
              {footerCtaLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
