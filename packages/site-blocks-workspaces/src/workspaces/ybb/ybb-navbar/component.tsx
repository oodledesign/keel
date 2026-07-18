'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { YBB_DEFAULTS } from '../defaults';
import '../ybb-buttons.css';
import { YBB_DEFAULT_NAV_LINKS, type YbbNavLink } from '../ybb-nav-types';
import { ybbCtaClassName } from '../ybb-styles';
import './ybb-navbar.css';

export type YbbNavbarProps = {
  logoUrl?: string;
  homeHref?: string;
  navLinks?: YbbNavLink[];
  ctaLabel?: string;
  ctaHref?: string;
  ctaVariant?: string;
  textTone?: 'auto' | 'light' | 'dark';
};

function parseRgb(color: string) {
  const values = color.match(/[\d.]+/g);
  return values ? values.slice(0, 3).map(Number) : [255, 255, 243];
}

function luminance(rgb: number[]) {
  const channels = rgb.map((channel) => {
    const value = (channel ?? 0) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

function getEffectiveBackground(element: Element | null) {
  let node = element as Element | null;
  while (node && node !== document.documentElement) {
    const { backgroundColor } = getComputedStyle(node);
    if (
      backgroundColor &&
      backgroundColor !== 'rgba(0, 0, 0, 0)' &&
      backgroundColor !== 'transparent'
    ) {
      return parseRgb(backgroundColor);
    }
    node = node.parentElement;
  }
  return [255, 255, 243];
}

export function YbbNavbar(props: YbbNavbarProps) {
  const logoUrl = props.logoUrl ?? YBB_DEFAULTS.logoNavUrl;
  const homeHref = props.homeHref ?? '/';
  const navLinks = props.navLinks?.length
    ? props.navLinks
    : YBB_DEFAULT_NAV_LINKS;
  const ctaLabel = props.ctaLabel ?? YBB_DEFAULTS.navCtaLabel;
  const ctaHref = props.ctaHref ?? YBB_DEFAULTS.navCtaHref;
  const ctaVariant = props.ctaVariant ?? 'primary';
  const textTone = props.textTone ?? 'auto';

  const headerRef = useRef<HTMLElement>(null);
  const adaptiveRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [onDark, setOnDark] = useState(false);

  const updateTone = useCallback(() => {
    if (textTone === 'light') {
      setOnDark(false);
      return;
    }
    if (textTone === 'dark') {
      setOnDark(true);
      return;
    }

    const adaptive = adaptiveRef.current;
    if (!adaptive) return;

    const rect = adaptive.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const sampleX = [0.2, 0.5, 0.8].map(
      (ratio) => rect.left + rect.width * ratio,
    );
    let total = 0;
    let count = 0;

    for (const x of sampleX) {
      const stack = document.elementsFromPoint(x, y);
      const behind = stack.find(
        (el) =>
          !el.closest('.ybbNavbar') &&
          !el.closest('.ybbBanner') &&
          !el.closest('[data-puck-overlay]'),
      );
      if (!behind) continue;
      total += luminance(getEffectiveBackground(behind));
      count += 1;
    }

    setOnDark(count > 0 ? total / count < 0.42 : false);
  }, [textTone]);

  useEffect(() => {
    updateTone();
    window.addEventListener('scroll', updateTone, { passive: true });
    window.addEventListener('resize', updateTone);
    return () => {
      window.removeEventListener('scroll', updateTone);
      window.removeEventListener('resize', updateTone);
    };
  }, [updateTone]);

  const ctaClass = ybbCtaClassName(ctaVariant, onDark);

  return (
    <header
      ref={headerRef}
      className={`ybbNavbar${onDark ? 'ybbNavbarOnDark' : 'ybbNavbarOnLight'}`}
    >
      <div className="ybbNavbarFloat">
        <div className="ybbNavbarPill">
          <div ref={adaptiveRef} className="ybbNavbarAdaptive">
            <a
              href={homeHref}
              className="ybbNavbarLogo"
              aria-label="Your Bridal Besties home"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" width={64} height={100} />
              ) : null}
            </a>

            <nav className="ybbNavbarNav" aria-label="Main navigation">
              <ul className="ybbNavbarLinks">
                {navLinks.map((link) =>
                  link.label ? (
                    <li key={`${link.label}-${link.href}`}>
                      <a href={link.href || '#'}>
                        {link.label}
                        {link.hasDropdown ? (
                          <span className="ybbNavbarChevron" aria-hidden>
                            ▾
                          </span>
                        ) : null}
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            </nav>

            <button
              type="button"
              className="ybbNavbarToggle"
              aria-expanded={mobileOpen}
              aria-controls="ybb-mobile-nav"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          {ctaLabel ? (
            <a className={`${ctaClass} ybbNavbarCta`} href={ctaHref || '#'}>
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </div>

      {!mobileOpen ? null : (
        <nav
          id="ybb-mobile-nav"
          className="ybbNavbarMobile"
          aria-label="Mobile navigation"
        >
          <ul>
            {navLinks.map((link) =>
              link.label ? (
                <li key={`mobile-${link.label}-${link.href}`}>
                  <a
                    href={link.href || '#'}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                </li>
              ) : null,
            )}
            {ctaLabel ? (
              <li>
                <a
                  className={`${ctaClass} ybbNavbarCta ybbNavbarCtaMobile`}
                  href={ctaHref || '#'}
                >
                  {ctaLabel}
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
      )}
    </header>
  );
}
