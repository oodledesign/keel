'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

import { YBB_DEFAULTS } from '../defaults';

import './ybb-hero.css';

export type YbbHeroProps = {
  logoUrl?: string;
  tagline?: string;
  videoUrl?: string;
  videoAlt?: string;
  textureUrl?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};

export function YbbHero(props: YbbHeroProps) {
  const logoUrl = props.logoUrl ?? YBB_DEFAULTS.logoUrl;
  const tagline = props.tagline ?? YBB_DEFAULTS.tagline;
  const videoUrl = props.videoUrl ?? YBB_DEFAULTS.heroVideoUrl;
  const videoAlt = props.videoAlt ?? YBB_DEFAULTS.heroVideoAlt;
  const textureUrl = props.textureUrl ?? YBB_DEFAULTS.heroTextureUrl;
  const primaryCtaLabel = props.primaryCtaLabel ?? YBB_DEFAULTS.primaryCtaLabel;
  const primaryCtaHref = props.primaryCtaHref ?? YBB_DEFAULTS.primaryCtaHref;
  const secondaryCtaLabel =
    props.secondaryCtaLabel ?? YBB_DEFAULTS.secondaryCtaLabel;
  const secondaryCtaHref =
    props.secondaryCtaHref ?? YBB_DEFAULTS.secondaryCtaHref;

  const pinRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const pin = pinRef.current;
    const hero = heroRef.current;
    if (!pin || !hero) return;

    if (window.matchMedia('(max-width: 991px)').matches) return;

    const setPassed = (passed: boolean) => {
      hero.classList.toggle('ybbHeroPassed', passed);
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry) setPassed(!entry.isIntersecting);
        },
        { threshold: 0, rootMargin: '0px' },
      );
      io.observe(pin);
      return () => io.disconnect();
    }
  }, []);

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
      ref={pinRef}
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
        ref={heroRef}
        className="ybbHero"
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
              <img
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
            <div className="ybbHeroActions">
              {primaryCtaLabel ? (
                <a
                  className="ybbHeroBtnPrimary"
                  href={primaryCtaHref || '#'}
                >
                  {primaryCtaLabel}
                </a>
              ) : null}
              {secondaryCtaLabel ? (
                <a
                  className="ybbHeroBtnSecondary"
                  href={secondaryCtaHref || '#'}
                >
                  {secondaryCtaLabel}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
