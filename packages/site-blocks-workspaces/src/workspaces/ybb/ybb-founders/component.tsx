'use client';

import type { CSSProperties } from 'react';

import { YBB_DEFAULTS } from '../defaults';
import '../ybb-buttons.css';
import { resolveYbbColorVar, ybbCtaClassName } from '../ybb-styles';
import './ybb-founders.css';

function cssUrl(value: string): string {
  return `url("${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
}

export type YbbFoundersProps = {
  sectionId?: string;
  title?: string;
  body?: string;
  showCta?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  ctaVariant?: string;
  photoUrl?: string;
  photoAlt?: string;
  starOuterUrl?: string;
  starInnerUrl?: string;
  starMaskUrl?: string;
  backgroundToken?: string;
  backgroundColor?: string;
  textColor?: string;
  maskFillColor?: string;
};

export function YbbFounders(props: YbbFoundersProps) {
  const sectionId = props.sectionId ?? 'team';
  const title = props.title ?? YBB_DEFAULTS.foundersTitle;
  const body = props.body ?? YBB_DEFAULTS.foundersBody;
  const showCta = props.showCta ?? true;
  const ctaLabel = props.ctaLabel ?? YBB_DEFAULTS.foundersCtaLabel;
  const ctaHref = props.ctaHref ?? YBB_DEFAULTS.foundersCtaHref;
  const ctaVariant = props.ctaVariant ?? 'primary';
  const photoUrl = props.photoUrl ?? YBB_DEFAULTS.foundersPhotoUrl;
  const photoAlt =
    props.photoAlt ?? 'Zoe and Eloise — Your Bridal Besties founders';
  const starOuterUrl = props.starOuterUrl ?? YBB_DEFAULTS.foundersStarOuterUrl;
  const starInnerUrl = props.starInnerUrl ?? YBB_DEFAULTS.foundersStarInnerUrl;
  const starMaskUrl = props.starMaskUrl ?? YBB_DEFAULTS.foundersStarMaskUrl;

  const background = resolveYbbColorVar({
    token: props.backgroundToken ?? 'custom',
    customColor: props.backgroundColor ?? '#B9A949',
    fallback: '#B9A949',
  });
  const textColor = props.textColor ?? '#2C4F35';
  const maskFillColor = props.maskFillColor ?? '#800000';

  const sectionStyle = {
    background,
    color: textColor,
    ['--ybb-founders-text' as string]: textColor,
    ['--ybb-founders-mask-fill' as string]: maskFillColor,
    ['--ybb-founders-star-mask' as string]: starMaskUrl
      ? cssUrl(starMaskUrl)
      : 'none',
  } as CSSProperties;

  return (
    <section
      id={sectionId || undefined}
      className="ybbFounders"
      style={sectionStyle}
      aria-labelledby={`${sectionId}-heading`}
    >
      <div className="ybbFoundersInner">
        <div className="ybbFoundersContent">
          <h2 className="ybbFoundersTitle" id={`${sectionId}-heading`}>
            {title}
          </h2>
          {body ? <p className="ybbFoundersBody">{body}</p> : null}
          {showCta && ctaLabel ? (
            <a
              className={`${ybbCtaClassName(ctaVariant)} ybbFoundersCta`}
              href={ctaHref || '#'}
            >
              {ctaLabel}
            </a>
          ) : null}
        </div>

        <div className="ybbFoundersVisual">
          <div className="ybbFoundersStack">
            {starOuterUrl ? (
              <img
                className="ybbFoundersRing ybbFoundersRingOuter"
                src={starOuterUrl}
                alt=""
                aria-hidden
              />
            ) : null}
            {starInnerUrl ? (
              <img
                className="ybbFoundersRing ybbFoundersRingInner"
                src={starInnerUrl}
                alt=""
                aria-hidden
              />
            ) : null}
            <figure className="ybbFoundersPhoto">
              <div className="ybbFoundersPhotoMask">
                <div className="ybbFoundersPhotoClip">
                  {photoUrl ? (
                    <img src={photoUrl} alt={photoAlt} loading="lazy" />
                  ) : (
                    <div className="ybbFoundersPhotoPlaceholder" aria-hidden />
                  )}
                </div>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
