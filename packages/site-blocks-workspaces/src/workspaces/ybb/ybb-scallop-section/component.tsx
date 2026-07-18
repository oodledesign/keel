'use client';

import type { CSSProperties } from 'react';

import { YBB_DEFAULTS } from '../defaults';
import '../ybb-buttons.css';
import { resolveYbbColorVar, ybbCtaClassName } from '../ybb-styles';
import './ybb-scallop-section.css';

export type YbbScallopSectionProps = {
  sectionId?: string;
  overlapPrevious?: boolean;
  scriptLine?: string;
  headingBefore?: string;
  headingAccent?: string;
  headingAfter?: string;
  body?: string;
  photoLeftUrl?: string;
  photoRightUrl?: string;
  photoAccentUrl?: string;
  bandBackgroundToken?: string;
  bandBackgroundColor?: string;
  scallopFillToken?: string;
  scallopFillColor?: string;
  showPrimaryCta?: boolean;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  primaryCtaVariant?: string;
  showSecondaryCta?: boolean;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  secondaryCtaVariant?: string;
};

export function YbbScallopSection(props: YbbScallopSectionProps) {
  const sectionId = props.sectionId ?? 'about';
  const overlapPrevious = props.overlapPrevious ?? true;
  const scriptLine = props.scriptLine ?? YBB_DEFAULTS.scallopScriptLine;
  const headingBefore = props.headingBefore ?? "We're the girlies you ";
  const headingAccent = props.headingAccent ?? 'actually want';
  const headingAfter = props.headingAfter ?? ' around on your wedding morning';
  const body = props.body ?? YBB_DEFAULTS.scallopBody;
  const bandBackgroundToken = props.bandBackgroundToken ?? 'custom';
  const bandBackgroundColor =
    props.bandBackgroundColor ?? YBB_DEFAULTS.scallopBandColor;
  const scallopFillToken = props.scallopFillToken ?? 'custom';
  const scallopFillColor =
    props.scallopFillColor ?? YBB_DEFAULTS.scallopBottomFillColor;
  const showPrimaryCta = props.showPrimaryCta ?? true;
  const showSecondaryCta = props.showSecondaryCta ?? true;
  const primaryCtaLabel = props.primaryCtaLabel ?? YBB_DEFAULTS.primaryCtaLabel;
  const primaryCtaHref = props.primaryCtaHref ?? YBB_DEFAULTS.primaryCtaHref;
  const primaryCtaVariant = props.primaryCtaVariant ?? 'primary';
  const secondaryCtaLabel =
    props.secondaryCtaLabel ?? YBB_DEFAULTS.secondaryCtaLabel;
  const secondaryCtaHref =
    props.secondaryCtaHref ?? YBB_DEFAULTS.secondaryCtaHref;
  const secondaryCtaVariant = props.secondaryCtaVariant ?? 'tertiary';

  const bandColor = resolveYbbColorVar({
    token: bandBackgroundToken,
    customColor: bandBackgroundColor,
    fallback: YBB_DEFAULTS.scallopBandColor,
  });
  const fillColor = resolveYbbColorVar({
    token: scallopFillToken,
    customColor: scallopFillColor,
    fallback: YBB_DEFAULTS.scallopBottomFillColor,
  });

  const sectionStyle = {
    ['--ybb-scallop-band' as string]: bandColor,
    ['--ybb-scallop-fill' as string]: fillColor,
  } as CSSProperties;

  return (
    <section
      id={sectionId || undefined}
      className={`ybbScallopSection${overlapPrevious ? 'ybbScallopSectionOverlap' : ''}`}
      style={sectionStyle}
      aria-labelledby={`${sectionId}-heading`}
    >
      <div className="ybbScallopBand">
        <div className="ybbScallopEdge ybbScallopEdgeTop" aria-hidden />
        <div className="ybbScallopEdge ybbScallopEdgeBottom" aria-hidden />

        {scriptLine ? (
          <p className="ybbScallopScript" aria-hidden>
            {scriptLine}
          </p>
        ) : null}

        <div className="ybbScallopInner">
          {props.photoLeftUrl ? (
            <figure className="ybbScallopPhoto ybbScallopPhotoLeft">
              <img src={props.photoLeftUrl} alt="" loading="lazy" />
            </figure>
          ) : null}
          {props.photoRightUrl ? (
            <figure className="ybbScallopPhoto ybbScallopPhotoRight">
              <img src={props.photoRightUrl} alt="" loading="lazy" />
            </figure>
          ) : null}
          {props.photoAccentUrl ? (
            <figure className="ybbScallopPhoto ybbScallopPhotoAccent">
              <img src={props.photoAccentUrl} alt="" loading="lazy" />
            </figure>
          ) : null}

          <div className="ybbScallopContent">
            <h2 className="ybbScallopHeading" id={`${sectionId}-heading`}>
              {headingBefore ? (
                <span className="ybbScallopHeadingLight">{headingBefore}</span>
              ) : null}
              {headingAccent ? (
                <em className="ybbScallopHeadingAccent">{headingAccent}</em>
              ) : null}
              {headingAfter ? (
                <span className="ybbScallopHeadingLight">{headingAfter}</span>
              ) : null}
            </h2>
            {body ? <p className="ybbScallopBody">{body}</p> : null}
            {showPrimaryCta || showSecondaryCta ? (
              <div className="ybbScallopActions">
                {showPrimaryCta && primaryCtaLabel ? (
                  <a
                    className={ybbCtaClassName(primaryCtaVariant, true)}
                    href={primaryCtaHref || '#'}
                  >
                    {primaryCtaLabel}
                  </a>
                ) : null}
                {showSecondaryCta && secondaryCtaLabel ? (
                  <a
                    className={ybbCtaClassName(secondaryCtaVariant, true)}
                    href={secondaryCtaHref || '#'}
                  >
                    {secondaryCtaLabel}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
