'use client';

import type { CSSProperties } from 'react';

import {
  YBB_DEFAULTS,
  YBB_DEFAULT_GLAM_CARDS,
  type YbbGlamCardSlot,
} from '../defaults';
import '../ybb-buttons.css';
import { YbbImage } from '../ybb-image';
import { resolveYbbBackgroundStyle, ybbPolaroidCtaClass } from '../ybb-styles';
import './ybb-glam-girls.css';

export type YbbGlamCard = {
  slot?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaColor?: string;
  tilt?: string;
  featured?: boolean;
  squarePhoto?: boolean;
  linkLabel?: string;
  linkHref?: string;
};

export type YbbGlamGirlsProps = {
  sectionId?: string;
  overlapScallop?: boolean;
  title?: string;
  kicker?: string;
  backgroundToken?: string;
  backgroundColor?: string;
  kickerColor?: string;
  cards?: YbbGlamCard[];
};

function cardBySlot(
  cards: YbbGlamCard[],
  slot: YbbGlamCardSlot,
): YbbGlamCard | undefined {
  return cards.find((card) => card.slot === slot);
}

function cardsWithDefaultImages(cards: YbbGlamCard[]): YbbGlamCard[] {
  return cards.map((card) => {
    const fallback = YBB_DEFAULT_GLAM_CARDS.find(
      (defaultCard) => defaultCard.slot === card.slot,
    );
    const imageUrl = card.imageUrl?.trim() || fallback?.imageUrl || '';
    return imageUrl === card.imageUrl ? card : { ...card, imageUrl };
  });
}

function renderTitleLines(title: string) {
  const lines = title.split('\n').filter(Boolean);
  return lines.map((line, index) => (
    <span key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

function sanitizeTiltDegrees(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return '0deg';
  }
  return `${trimmed}deg`;
}

function imageAltText(card: YbbGlamCard): string {
  if (card.imageAlt?.trim()) {
    return card.imageAlt.trim();
  }
  return card.title?.trim() ?? '';
}

function Polaroid({
  card,
  loveTitle = false,
  ctaOffset,
}: {
  card: YbbGlamCard;
  loveTitle?: boolean;
  ctaOffset?: string;
}) {
  const tilt = sanitizeTiltDegrees(card.tilt);
  const offset = ctaOffset ?? (card.featured ? '-8deg' : '7deg');

  return (
    <article className="ybbGlamCell ybbGlamCellPolaroid">
      <div
        className={`ybbGlamPolaroid${card.featured ? ' ybbGlamPolaroidFeatured' : ''}`}
        style={
          {
            ['--ybb-glam-tilt' as string]: tilt,
            ['--ybb-glam-cta-offset' as string]: offset,
          } as CSSProperties
        }
      >
        <div className="ybbGlamPolaroidMedia">
          {card.imageUrl ? (
            <figure
              className={`ybbGlamPolaroidPhoto${card.squarePhoto ? ' ybbGlamPolaroidPhotoSquare' : ''}`}
            >
              <YbbImage
                src={card.imageUrl}
                alt={imageAltText(card)}
                loading="lazy"
              />
            </figure>
          ) : (
            <figure
              className={`ybbGlamPolaroidPhoto ybbGlamPolaroidPhotoEmpty${card.squarePhoto ? ' ybbGlamPolaroidPhotoSquare' : ''}`}
              aria-hidden
            />
          )}
          {card.ctaLabel ? (
            <a
              className={`ybbBtnPrimary ybbGlamPolaroidCta ${ybbPolaroidCtaClass(card.ctaColor)}`}
              href={card.ctaHref || '#'}
            >
              {card.ctaLabel}
            </a>
          ) : null}
        </div>
        <div className="ybbGlamPolaroidCaption">
          <h3 className={loveTitle ? 'ybbGlamCellTitle' : undefined}>
            {card.title}
          </h3>
          {card.body ? <p>{card.body}</p> : null}
        </div>
      </div>
    </article>
  );
}

function SpeechBubble({
  card,
  align,
}: {
  card: YbbGlamCard;
  align: 'left' | 'right';
}) {
  const avatar = card.imageUrl ? (
    <YbbImage
      className="ybbGlamAvatar"
      src={card.imageUrl}
      alt={imageAltText(card)}
      loading="lazy"
    />
  ) : null;

  return (
    <article className="ybbGlamCell ybbGlamCellBubble">
      <div
        className={`ybbGlamSpeech ybbGlamSpeech${align === 'left' ? 'Left' : 'Right'}`}
      >
        {align === 'left' ? avatar : null}
        <div className="ybbGlamSpeechBody">
          {card.title ? <h3>{card.title}</h3> : null}
          {card.body ? <p>{card.body}</p> : null}
          {card.linkLabel ? (
            <a className="ybbGlamSpeechLink" href={card.linkHref || '#'}>
              {card.linkLabel}
            </a>
          ) : null}
        </div>
        {align === 'right' ? avatar : null}
      </div>
    </article>
  );
}

export function YbbGlamGirls(props: YbbGlamGirlsProps) {
  const sectionId = props.sectionId ?? 'services';
  const overlapScallop = props.overlapScallop ?? true;
  const title = props.title ?? YBB_DEFAULTS.glamGirlsTitle;
  const kicker = props.kicker ?? YBB_DEFAULTS.glamGirlsKicker;
  const kickerColor = props.kickerColor ?? '#550100';
  const cards = cardsWithDefaultImages(
    props.cards && props.cards.length > 0
      ? props.cards
      : YBB_DEFAULT_GLAM_CARDS,
  );

  const sectionStyle = {
    ...resolveYbbBackgroundStyle({
      backgroundToken: props.backgroundToken ?? 'custom',
      backgroundColor:
        props.backgroundColor?.trim() || YBB_DEFAULTS.glamGirlsBackgroundColor,
      fallbackColor: YBB_DEFAULTS.glamGirlsBackgroundColor,
    }),
    ['--ybb-glam-kicker' as string]: kickerColor,
    ['--ybb-glam-maroon' as string]: kickerColor,
  } as CSSProperties;

  const leftPolaroid = cardBySlot(cards, 'leftPolaroid');
  const leftSpeech = cardBySlot(cards, 'leftSpeech');
  const centerPolaroid = cardBySlot(cards, 'centerPolaroid');
  const rightSpeech = cardBySlot(cards, 'rightSpeech');
  const rightPolaroid = cardBySlot(cards, 'rightPolaroid');

  return (
    <section
      id={sectionId || undefined}
      className={`ybbGlamGirls${overlapScallop ? ' ybbGlamGirlsOverlap' : ''}`}
      style={sectionStyle}
      aria-labelledby={`${sectionId}-heading`}
    >
      <div className="ybbGlamInner">
        <header className="ybbGlamHeader">
          <h2 className="ybbGlamTitle" id={`${sectionId}-heading`}>
            {renderTitleLines(title)}
          </h2>
          {kicker ? (
            <div className="ybbGlamKicker">
              <p className="ybbGlamKickerText">{kicker}</p>
              <svg
                className="ybbGlamKickerArrow"
                viewBox="0 0 160 96"
                aria-hidden
              >
                <path
                  d="M10,8 C44,10 78,30 108,52 C122,62 132,72 136,78"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                />
                <path
                  d="M136,78 L152,90 L124,86 Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ) : null}
        </header>

        <div className="ybbGlamLayout">
          <div className="ybbGlamMosaic">
            <div className="ybbGlamMosaicCol ybbGlamMosaicColLeft">
              {leftPolaroid ? <Polaroid card={leftPolaroid} /> : null}
              {leftSpeech ? (
                <SpeechBubble card={leftSpeech} align="left" />
              ) : null}
            </div>

            <div className="ybbGlamMosaicCol ybbGlamMosaicColCenter">
              {centerPolaroid ? (
                <Polaroid card={centerPolaroid} ctaOffset="-8deg" />
              ) : null}
            </div>

            <div className="ybbGlamMosaicCol ybbGlamMosaicColRight">
              {rightSpeech ? (
                <SpeechBubble card={rightSpeech} align="right" />
              ) : null}
              {rightPolaroid ? (
                <div className="ybbGlamMosaicLove">
                  <Polaroid card={rightPolaroid} loveTitle ctaOffset="8deg" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
