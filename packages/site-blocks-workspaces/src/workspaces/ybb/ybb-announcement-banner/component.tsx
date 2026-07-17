'use client';

import { useEffect, useState } from 'react';

import { YBB_DEFAULTS } from '../defaults';
import { resolveYbbBackgroundStyle } from '../ybb-styles';

import './ybb-announcement-banner.css';

export type YbbAnnouncementBannerProps = {
  enabled?: boolean;
  iconUrl?: string;
  heading?: string;
  subtext?: string;
  showForm?: boolean;
  emailPlaceholder?: string;
  buttonLabel?: string;
  formAction?: string;
  dismissible?: boolean;
  backgroundToken?: string;
  backgroundColor?: string;
};

export function YbbAnnouncementBanner(props: YbbAnnouncementBannerProps) {
  const enabled = props.enabled ?? true;
  const iconUrl = props.iconUrl ?? YBB_DEFAULTS.monogramUrl;
  const heading = props.heading ?? YBB_DEFAULTS.announcementHeading;
  const subtext = props.subtext ?? YBB_DEFAULTS.announcementSubtext;
  const showForm = props.showForm ?? true;
  const emailPlaceholder =
    props.emailPlaceholder ?? YBB_DEFAULTS.announcementEmailPlaceholder;
  const buttonLabel =
    props.buttonLabel ?? YBB_DEFAULTS.announcementButtonLabel;
  const formAction = props.formAction ?? YBB_DEFAULTS.announcementFormAction;
  const dismissible = props.dismissible ?? true;
  const backgroundToken = props.backgroundToken ?? 'custom';
  const backgroundColor =
    props.backgroundColor ?? YBB_DEFAULTS.scallopBandColor;

  const [dismissed, setDismissed] = useState(false);
  const visible = enabled && !dismissed;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('ybbHasBanner', visible);
    document.documentElement.style.setProperty(
      '--ybb-banner-offset',
      visible ? '2em' : '0px',
    );
    return () => {
      document.documentElement.classList.remove('ybbHasBanner');
      document.documentElement.style.removeProperty('--ybb-banner-offset');
    };
  }, [visible]);

  if (!visible) return null;

  const bandStyle = resolveYbbBackgroundStyle({
    backgroundToken,
    backgroundColor,
  });

  return (
    <div className="ybbBanner" style={bandStyle} data-ybb-banner>
      <div className="ybbBannerInner">
        <div className="ybbBannerMessage">
          {iconUrl ? (
            <img className="ybbBannerIcon" src={iconUrl} alt="" aria-hidden />
          ) : null}
          <p className="ybbBannerHeading">{heading}</p>
          {subtext ? <p className="ybbBannerSubtext">{subtext}</p> : null}
        </div>

        {showForm ? (
          <form
            className="ybbBannerForm"
            action={formAction}
            method="post"
            encType="text/plain"
          >
            <label className="ybbBannerSrOnly" htmlFor="ybb-banner-email">
              Email address
            </label>
            <input
              id="ybb-banner-email"
              type="email"
              name="email"
              placeholder={emailPlaceholder}
              required
              autoComplete="email"
            />
            <button type="submit">{buttonLabel}</button>
          </form>
        ) : null}

        {dismissible ? (
          <button
            type="button"
            className="ybbBannerClose"
            aria-label="Dismiss banner"
            onClick={() => setDismissed(true)}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
