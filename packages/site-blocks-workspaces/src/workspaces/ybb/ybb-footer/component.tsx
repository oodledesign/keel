'use client';

import type { CSSProperties } from 'react';

import { YBB_DEFAULTS } from '../defaults';

import './ybb-footer.css';

export type YbbFooterNavLink = {
  label?: string;
  href?: string;
};

export type YbbFooterProps = {
  pressHeading?: string;
  logoWideUrl?: string;
  monogramUrl?: string;
  textureUrl?: string;
  cutoutImageUrl?: string;
  email?: string;
  socialHandle?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  copyrightTagline?: string;
  navLinks?: YbbFooterNavLink[];
};

function MailIcon() {
  return (
    <svg className="ybbFooterContactIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="ybbFooterContactIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.97.24 2.427.403a4.92 4.92 0 0 1 1.77 1.153 4.92 4.92 0 0 1 1.153 1.77c.163.457.349 1.257.403 2.427.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.24 1.97-.403 2.427a4.92 4.92 0 0 1-1.153 1.77 4.92 4.92 0 0 1-1.77 1.153c-.457.163-1.257.349-2.427.403-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.97-.24-2.427-.403a4.92 4.92 0 0 1-1.77-1.153 4.92 4.92 0 0 1-1.153-1.77c-.163-.457-.349-1.257-.403-2.427C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.054-1.17.24-1.97.403-2.427a4.92 4.92 0 0 1 1.153-1.77 4.92 4.92 0 0 1 1.77-1.153c.457-.163 1.257-.349 2.427-.403C8.416 2.175 8.796 2.163 12 2.163zm0 1.62c-3.15 0-3.516.012-4.746.068-1.002.046-1.547.217-1.908.361a3.28 3.28 0 0 0-1.183.77 3.28 3.28 0 0 0-.77 1.183c-.144.361-.315.906-.361 1.908-.056 1.23-.068 1.596-.068 4.746s.012 3.516.068 4.746c.046 1.002.217 1.547.361 1.908.17.428.399.776.77 1.183.407.371.755.6 1.183.77.361.144.906.315 1.908.361 1.23.056 1.596.068 4.746.068s3.516-.012 4.746-.068c1.002-.046 1.547-.217 1.908-.361a3.28 3.28 0 0 0 1.183-.77 3.28 3.28 0 0 0 .77-1.183c.144-.361.315-.906.361-1.908.056-1.23.068-1.596.068-4.746s-.012-3.516-.068-4.746c-.046-1.002-.217-1.547-.361-1.908a3.28 3.28 0 0 0-.77-1.183 3.28 3.28 0 0 0-1.183-.77c-.361-.144-.906-.315-1.908-.361-1.23-.056-1.596-.068-4.746-.068zM12 7.378A4.622 4.622 0 1 1 7.378 12 4.622 4.622 0 0 1 12 7.378zm0 7.622a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm4.804-8.884a1.08 1.08 0 1 1-1.08-1.08 1.08 1.08 0 0 1 1.08 1.08z"
      />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg className="ybbFooterContactIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.6 5.82s.51.5 0 0A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.1 4.1 0 0 1-1-.48z"
      />
    </svg>
  );
}

const DEFAULT_NAV_LINKS: YbbFooterNavLink[] = [
  { label: 'About us', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Portfolio', href: '#portfolio' },
  { label: 'FAQ', href: '#faq' },
];

export function YbbFooter(props: YbbFooterProps) {
  const pressHeading = props.pressHeading ?? YBB_DEFAULTS.pressHeading;
  const logoWideUrl = props.logoWideUrl ?? YBB_DEFAULTS.logoWideUrl;
  const monogramUrl = props.monogramUrl ?? YBB_DEFAULTS.monogramUrl;
  const textureUrl = props.textureUrl ?? YBB_DEFAULTS.footerTextureUrl;
  const cutoutImageUrl = props.cutoutImageUrl ?? YBB_DEFAULTS.footerCutoutUrl;
  const email = props.email ?? YBB_DEFAULTS.email;
  const socialHandle = props.socialHandle ?? YBB_DEFAULTS.socialHandle;
  const instagramUrl = props.instagramUrl ?? YBB_DEFAULTS.instagramUrl;
  const tiktokUrl = props.tiktokUrl ?? YBB_DEFAULTS.tiktokUrl;
  const copyrightTagline =
    props.copyrightTagline ?? YBB_DEFAULTS.copyrightTagline;
  const navLinks =
    props.navLinks && props.navLinks.length > 0
      ? props.navLinks
      : DEFAULT_NAV_LINKS;

  const year = new Date().getFullYear();
  const textureStyle = textureUrl
    ? ({
        ['--ybb-footer-texture' as string]: `url("${encodeURI(textureUrl)}")`,
      } as CSSProperties)
    : undefined;

  return (
    <footer
      className="ybbFooter"
      style={textureStyle}
    >
      <section className="ybbPress" aria-labelledby="ybb-press-heading">
        <div className="ybbPressInner">
          <p className="ybbPressText" id="ybb-press-heading">
            {pressHeading}
          </p>
          <div
            className="ybbPressLogos"
            aria-label="Press and partner logos (coming soon)"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                // Puck array items have no stable ids; index is the least-bad key.
                key={index}
                className="ybbPressLogoPlaceholder"
                aria-hidden="true"
              >
                {monogramUrl ? (
                  <img src={monogramUrl} alt="" width={56} height={56} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="ybbFooterCardWrap">
        <div className="ybbFooterStage">
          <div className="ybbFooterCard" style={textureStyle}>
            <div className="ybbFooterLinks">
              <a href="/" className="ybbFooterLogo">
                {logoWideUrl ? (
                  <img
                    src={logoWideUrl}
                    alt="Your Bridal Besties"
                    width={140}
                    height={60}
                  />
                ) : null}
              </a>
              <nav className="ybbFooterNav" aria-label="Footer navigation">
                <ul>
                  {navLinks.map((link, index) => (
                    <li
                      // Puck array items have no stable ids; index is the least-bad key.
                      key={index}
                    >
                      <a href={link.href ?? '#'}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="ybbFooterContact">
                <a
                  className="ybbFooterContactLink"
                  href={`mailto:${email}`}
                >
                  <MailIcon />
                  <span>{email}</span>
                </a>
                <a
                  className="ybbFooterContactLink"
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <InstagramIcon />
                  <span>{socialHandle}</span>
                </a>
                <a
                  className="ybbFooterContactLink"
                  href={tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TikTokIcon />
                  <span>{socialHandle}</span>
                </a>
              </div>
            </div>
          </div>

          <p className="ybbFooterBottom">
            © {year} Your Bridal Besties. {copyrightTagline}
          </p>
        </div>
      </div>

      {cutoutImageUrl ? (
        <img
          className="ybbFooterCutout"
          src={cutoutImageUrl}
          alt=""
          width={707}
          height={816}
          loading="lazy"
          aria-hidden="true"
        />
      ) : null}
    </footer>
  );
}
