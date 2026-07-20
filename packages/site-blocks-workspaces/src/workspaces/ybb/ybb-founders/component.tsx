'use client';

import type { CSSProperties } from 'react';

import { YBB_DEFAULTS } from '../defaults';
import {
  YBB_FOUNDERS_MASK_FILL,
  YBB_FOUNDERS_STAR_INNER,
  YBB_FOUNDERS_STAR_MASK,
  YBB_FOUNDERS_STAR_OUTER,
} from '../ybb-assets';
import '../ybb-buttons.css';
import { YbbImage } from '../ybb-image';
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
  backgroundToken?: string;
  backgroundColor?: string;
  textColor?: string;
};

export function YbbFounders(props: YbbFoundersProps) {
  const sectionId = props.sectionId ?? 'team';
  const title = props.title ?? YBB_DEFAULTS.foundersTitle;
  const body = props.body ?? YBB_DEFAULTS.foundersBody;
  const showCta = props.showCta ?? true;
  const ctaLabel = props.ctaLabel ?? YBB_DEFAULTS.foundersCtaLabel;
  const ctaHref = props.ctaHref ?? YBB_DEFAULTS.foundersCtaHref;
  const ctaVariant = props.ctaVariant ?? 'primary';
  const photoUrl = props.photoUrl?.trim() || YBB_DEFAULTS.foundersPhotoUrl;
  const photoAlt =
    props.photoAlt ?? 'Zoe and Eloise — Your Bridal Besties founders';

  const background = resolveYbbColorVar({
    token: props.backgroundToken ?? 'custom',
    customColor: props.backgroundColor?.trim() || '#B9A949',
    fallback: '#B9A949',
  });
  const textColor = props.textColor?.trim() || '#2C4F35';

  const sectionStyle = {
    background,
    color: textColor,
    ['--ybb-founders-text' as string]: textColor,
    ['--ybb-founders-mask-fill' as string]: YBB_FOUNDERS_MASK_FILL,
    ['--ybb-founders-star-mask' as string]: cssUrl(YBB_FOUNDERS_STAR_MASK),
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
            <YbbImage
              className="ybbFoundersRing ybbFoundersRingOuter"
              src={YBB_FOUNDERS_STAR_OUTER}
              alt=""
              aria-hidden
            />
            <YbbImage
              className="ybbFoundersRing ybbFoundersRingInner"
              src={YBB_FOUNDERS_STAR_INNER}
              alt=""
              aria-hidden
            />
            <figure className="ybbFoundersPhoto">
              <div className="ybbFoundersPhotoMask">
                <div className="ybbFoundersPhotoClip">
                  {photoUrl ? (
                    <YbbImage src={photoUrl} alt={photoAlt} loading="lazy" />
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
