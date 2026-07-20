'use client';

import { type CSSProperties, useEffect, useRef } from 'react';

import { YBB_DEFAULTS } from '../defaults';
import '../ybb-buttons.css';
import { YbbImage } from '../ybb-image';
import { resolveYbbBackgroundStyle, ybbCtaClassName } from '../ybb-styles';
import './ybb-hero.css';

export type YbbHeroProps = {
  logoUrl?: string;
  tagline?: string;
  videoUrl?: string;
  videoAlt?: string;
  textureUrl?: string;
  backgroundToken?: string;
  backgroundColor?: string;
  showPrimaryCta?: boolean;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  primaryCtaVariant?: string;
  showSecondaryCta?: boolean;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  secondaryCtaVariant?: string;
};

export function YbbHero(props: YbbHeroProps) {
  const logoUrl = props.logoUrl ?? YBB_DEFAULTS.logoUrl;
  const tagline = props.tagline ?? YBB_DEFAULTS.tagline;
  const videoUrl = props.videoUrl ?? YBB_DEFAULTS.heroVideoUrl;
  const videoAlt = props.videoAlt ?? YBB_DEFAULTS.heroVideoAlt;
  const textureUrl = props.textureUrl ?? YBB_DEFAULTS.heroTextureUrl;
  const backgroundToken = props.backgroundToken ?? 'atmosphere';
  const backgroundColor = props.backgroundColor ?? '';
  const showPrimaryCta = props.showPrimaryCta ?? true;
  const showSecondaryCta = props.showSecondaryCta ?? true;
  const primaryCtaLabel = props.primaryCtaLabel ?? YBB_DEFAULTS.primaryCtaLabel;
  const primaryCtaHref = props.primaryCtaHref ?? YBB_DEFAULTS.primaryCtaHref;
  const primaryCtaVariant = props.primaryCtaVariant ?? 'primary';
  const secondaryCtaLabel =
    props.secondaryCtaLabel ?? YBB_DEFAULTS.secondaryCtaLabel;
  const secondaryCtaHref =
    props.secondaryCtaHref ?? YBB_DEFAULTS.secondaryCtaHref;
  const secondaryCtaVariant = props.secondaryCtaVariant ?? 'secondary';

  const videoRef = useRef<HTMLVideoElement>(null);

  const heroBackgroundStyle = resolveYbbBackgroundStyle({
    backgroundToken,
    backgroundColor,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      video.removeAttribute('autoplay');
      return;
    }

    video.play().catch(() => {});
  }, [videoUrl]);

  return (
    <div
      className="ybbHeroPin"
      style={
        textureUrl
          ? ({
              ['--ybb-hero-texture' as string]: `url("${encodeURI(textureUrl)}")`,
            } as CSSProperties)
          : undefined
      }
    >
      <section
        className="ybbHero"
        style={heroBackgroundStyle}
        aria-labelledby="ybb-hero-heading"
      >
        <div className="ybbHeroGrid">
          <div className="ybbHeroMedia">
            <div className="ybbHeroFrame">
              <div className="ybbHeroFrameMat">
                <div className="ybbHeroScallops" aria-hidden="true">
                  <span className="ybbHeroScallop ybbHeroScallopTop" />
                  <span className="ybbHeroScallop ybbHeroScallopRight" />
                  <span className="ybbHeroScallop ybbHeroScallopBottom" />
                  <span className="ybbHeroScallop ybbHeroScallopLeft" />
                </div>
                <div className="ybbHeroVideo">
                  {videoUrl ? (
                    <video
                      ref={videoRef}
                      className="ybbHeroVideoPlayer"
                      src={videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      aria-label={videoAlt}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="ybbHeroContent">
            {logoUrl ? (
              <YbbImage
                className="ybbHeroLogo"
                src={logoUrl}
                alt="Your Bridal Besties"
                width={447}
                height={120}
              />
            ) : null}
            <p className="ybbHeroTagline" id="ybb-hero-heading">
              {tagline}
            </p>
            {showPrimaryCta || showSecondaryCta ? (
              <div className="ybbHeroActions">
                {showPrimaryCta && primaryCtaLabel ? (
                  <a
                    className={ybbCtaClassName(primaryCtaVariant)}
                    href={primaryCtaHref || '#'}
                  >
                    {primaryCtaLabel}
                  </a>
                ) : null}
                {showSecondaryCta && secondaryCtaLabel ? (
                  <a
                    className={ybbCtaClassName(secondaryCtaVariant)}
                    href={secondaryCtaHref || '#'}
                  >
                    {secondaryCtaLabel}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
