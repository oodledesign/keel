'use client';

import type {
  VisionFinanceActuals,
  VisionSlide,
} from '~/lib/personal-vision/build-vision-slides';
import { formatVisionPence } from '~/lib/personal-vision/vision-finance-format';

function SlideShell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center overflow-y-auto bg-[var(--ozer-plum-900)] px-6 py-16 text-[var(--ozer-text-on-dark)] sm:px-10 md:px-16 ${className}`}
    >
      <div className="w-full max-w-3xl">{children}</div>
    </div>
  );
}

function SlideTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--ozer-font-display)] text-3xl font-bold tracking-tight text-[var(--ozer-text-on-dark)] md:text-4xl">
      {children}
    </h2>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-8 space-y-4">
      {items.map((item, i) => (
        <li
          key={i}
          className="border-l-2 border-[var(--ozer-coral-500)]/70 pl-4 text-base leading-relaxed text-[var(--ozer-text-on-dark)]/90 md:text-lg"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function FinanceActualsBlock({ actuals }: { actuals: VisionFinanceActuals }) {
  return (
    <div className="mt-6 rounded-xl border border-white/15 bg-black/25 px-4 py-3">
      <p className="text-xs tracking-wide text-[var(--ozer-text-on-dark-muted)] uppercase">
        This month · finance income
      </p>
      <p className="mt-1 text-2xl font-semibold text-[var(--ozer-coral-400)] tabular-nums">
        {formatVisionPence(actuals.incomePence)}
      </p>
      {actuals.workspaceNames.length ? (
        <p className="mt-1 text-xs text-[var(--ozer-text-on-dark-muted)]">
          From {actuals.workspaceNames.join(', ')}
        </p>
      ) : null}
      {!actuals.hasFinanceData ? (
        <p className="mt-1 text-xs text-[var(--ozer-text-on-dark-muted)]">
          No finance transactions found for the selected workspaces yet.
        </p>
      ) : null}
    </div>
  );
}

export function VisionSlideView({ slide }: { slide: VisionSlide }) {
  switch (slide.kind) {
    case 'cover':
      return (
        <SlideShell className="bg-gradient-to-br from-[var(--ozer-plum-950)] via-[var(--ozer-plum-900)] to-[var(--ozer-plum-800)]">
          <p className="text-sm font-medium tracking-[0.2em] text-[var(--ozer-coral-400)] uppercase">
            Personal Vision
          </p>
          <h1 className="mt-4 font-[family-name:var(--ozer-font-display)] text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            {slide.title}
          </h1>
          {slide.subtitle ? (
            <p className="mt-6 max-w-xl text-lg text-[var(--ozer-text-on-dark-muted)]">
              {slide.subtitle}
            </p>
          ) : null}
        </SlideShell>
      );

    case 'list':
      return (
        <SlideShell>
          <SlideTitle>{slide.title}</SlideTitle>
          <BulletList items={slide.items} />
        </SlideShell>
      );

    case 'prose':
      return (
        <SlideShell>
          <SlideTitle>{slide.title}</SlideTitle>
          <p className="mt-8 text-base leading-relaxed whitespace-pre-wrap text-[var(--ozer-text-on-dark)]/90 md:text-lg">
            {slide.body}
          </p>
        </SlideShell>
      );

    case 'legacy':
      return (
        <SlideShell>
          <SlideTitle>{slide.title}</SlideTitle>
          {slide.headline ? (
            <p className="mt-6 text-xl font-medium text-[var(--ozer-coral-400)]">
              {slide.headline}
            </p>
          ) : null}
          {slide.body ? (
            <p className="mt-4 text-base leading-relaxed whitespace-pre-wrap text-[var(--ozer-text-on-dark)]/90">
              {slide.body}
            </p>
          ) : null}
          {slide.wins.length ? <BulletList items={slide.wins} /> : null}
        </SlideShell>
      );

    case 'story':
      return (
        <SlideShell>
          <SlideTitle>{slide.title}</SlideTitle>
          <ol className="mt-8 space-y-5">
            {slide.items.map((item, i) => (
              <li key={i} className="flex gap-4">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--ozer-coral-500)]/50 text-xs text-[var(--ozer-coral-400)] tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-[var(--ozer-text-on-dark)]">
                    {item.label}
                  </p>
                  {item.detail ? (
                    <p className="mt-1 text-sm text-[var(--ozer-text-on-dark-muted)]">
                      {item.detail}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </SlideShell>
      );

    case 'character':
      return (
        <SlideShell>
          <SlideTitle>{slide.title}</SlideTitle>
          <div className="mt-8 space-y-6">
            {slide.traits.length ? (
              <div>
                <p className="text-xs tracking-wide text-[var(--ozer-text-on-dark-muted)] uppercase">
                  Traits
                </p>
                <BulletList items={slide.traits} />
              </div>
            ) : null}
            {slide.style.length ? (
              <div>
                <p className="text-xs tracking-wide text-[var(--ozer-text-on-dark-muted)] uppercase">
                  Style
                </p>
                <BulletList items={slide.style} />
              </div>
            ) : null}
            {slide.achievements.length ? (
              <div>
                <p className="text-xs tracking-wide text-[var(--ozer-text-on-dark-muted)] uppercase">
                  Achievements
                </p>
                <BulletList items={slide.achievements} />
              </div>
            ) : null}
            {slide.mentors.length ? (
              <div>
                <p className="text-xs tracking-wide text-[var(--ozer-text-on-dark-muted)] uppercase">
                  Mentors
                </p>
                <BulletList items={slide.mentors} />
              </div>
            ) : null}
            {slide.branding ? (
              <div>
                <p className="text-xs tracking-wide text-[var(--ozer-text-on-dark-muted)] uppercase">
                  Brand
                </p>
                <p className="mt-3 text-base leading-relaxed whitespace-pre-wrap">
                  {slide.branding}
                </p>
              </div>
            ) : null}
          </div>
        </SlideShell>
      );

    case 'goals':
      return (
        <SlideShell>
          <p className="text-sm font-medium tracking-wide text-[var(--ozer-coral-400)] uppercase">
            {slide.horizonLabel}
          </p>
          <SlideTitle>{slide.title}</SlideTitle>
          {slide.financeActuals ? (
            <FinanceActualsBlock actuals={slide.financeActuals} />
          ) : null}
          {slide.wealthGoals.length ? (
            <div className="mt-6">
              <p className="text-xs tracking-wide text-[var(--ozer-text-on-dark-muted)] uppercase">
                Wealth goals
              </p>
              <ul className="mt-3 space-y-3">
                {slide.wealthGoals.map((goal, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-2"
                  >
                    <span>{goal.label}</span>
                    {goal.targetPence != null ? (
                      <span className="text-[var(--ozer-coral-400)] tabular-nums">
                        {formatVisionPence(goal.targetPence)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {slide.otherGoals.length ? (
            <div className="mt-6">
              <p className="text-xs tracking-wide text-[var(--ozer-text-on-dark-muted)] uppercase">
                Goals
              </p>
              <BulletList items={slide.otherGoals} />
            </div>
          ) : null}
          {slide.standards.length ? (
            <div className="mt-6">
              <p className="text-xs tracking-wide text-[var(--ozer-text-on-dark-muted)] uppercase">
                Standards
              </p>
              <BulletList items={slide.standards} />
            </div>
          ) : null}
        </SlideShell>
      );

    case 'affirmations':
      return (
        <SlideShell>
          <SlideTitle>{slide.title}</SlideTitle>
          <ol className="mt-8 space-y-5">
            {slide.items.map((item, i) => (
              <li key={i} className="flex gap-4">
                <span className="mt-0.5 text-sm text-[var(--ozer-coral-400)] tabular-nums">
                  {i + 1}.
                </span>
                <p className="text-base leading-relaxed md:text-lg">{item}</p>
              </li>
            ))}
          </ol>
        </SlideShell>
      );

    default:
      return null;
  }
}
