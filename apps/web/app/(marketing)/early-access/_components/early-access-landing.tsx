import { Check } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { FeatureTour } from '~/(marketing)/_components/feature-tour';
import { MarketingFaqsSection } from '~/(marketing)/_components/marketing-faqs';
import { EarlyAccessBentoGrid } from '~/(marketing)/early-access/_components/early-access-bento-grid';
import { EarlyAccessEmailCapture } from '~/(marketing)/early-access/_components/early-access-email-capture';
import {
  EARLY_ACCESS_ACCENT_CLASS,
  EARLY_ACCESS_FAQS,
  EARLY_ACCESS_PERSONAS,
  EARLY_ACCESS_PILL_CHAIN,
} from '~/lib/marketing/early-access-content';
import {
  marketingCard,
  marketingEyebrow,
  marketingFeatureCard,
  marketingMutedText,
  marketingSectionHeading,
  marketingShellClass,
} from '~/lib/marketing/marketing-ui';

const section = 'relative mx-auto w-full max-w-7xl px-6';
const featureTourSection = 'relative mx-auto w-full max-w-[88rem] px-6';

function PillChain() {
  return (
    <div
      className="relative mx-auto mb-10 flex max-w-xl flex-wrap justify-center gap-5 pt-2 md:mb-12 md:gap-7"
      aria-hidden
    >
      <div className="absolute top-2 right-[6%] left-[6%] hidden h-px bg-[color:var(--workspace-shell-border)] md:block" />
      {EARLY_ACCESS_PILL_CHAIN.map((node) => (
        <div
          key={node.label}
          className="relative z-1 flex flex-col items-center gap-2"
        >
          <span
            className={cn(
              'block size-3.5 rounded-full',
              EARLY_ACCESS_ACCENT_CLASS[node.accent],
            )}
          />
          <span className="text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)]">
            {node.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mb-8 max-w-2xl text-center md:mx-auto md:mb-10">
      <p className="mb-2 text-xs font-medium tracking-[0.14em] text-[var(--workspace-shell-text-muted)] uppercase">
        {eyebrow}
      </p>
      <h2
        className={cn(
          marketingSectionHeading,
          'text-[var(--workspace-shell-text)]',
        )}
      >
        {title}
      </h2>
    </div>
  );
}

export function EarlyAccessLanding() {
  return (
    <main className={cn('relative', marketingShellClass)}>
      <header>
        <div
          className={cn(
            section,
            'flex flex-col pt-14 pb-16 text-center md:pt-20 md:pb-24',
          )}
        >
          <div className="mx-auto max-w-[46rem]">
            <span className={cn(marketingEyebrow, 'mx-auto')}>
              <span
                className="mr-2 inline-block size-1.5 rounded-full bg-[var(--ozer-sage-500)]"
                aria-hidden
              />
              Early access — now onboarding
            </span>

            <div className="mt-6 space-y-5 md:mt-8">
              <h1 className="font-heading text-[2.625rem] leading-[1.06] font-bold tracking-[-0.02em] text-[var(--workspace-shell-text)] md:text-6xl lg:text-[4.5rem]">
                Close the week knowing nothing slipped through.
              </h1>

              <p
                className={`mx-auto max-w-[34rem] text-base leading-[1.65] md:text-lg md:leading-[1.7] ${marketingMutedText}`}
              >
                Stop opening six tabs just to answer &ldquo;where are we with
                this client?&rdquo; Ozer holds the thread — from first enquiry
                to final invoice — in one calm workspace.
              </p>
            </div>

            <PillChain />

            <div id="join">
              <EarlyAccessEmailCapture id="hero-email" />
              <p className={`mt-4 text-sm ${marketingMutedText}`}>
                No spam. We read every reply and onboard people ourselves.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className={cn(section, 'py-16 md:py-20')}>
          <div
            className={cn(
              'mx-auto max-w-3xl rounded-[1.75rem] px-8 py-11 text-center md:px-10',
              marketingFeatureCard,
            )}
          >
            <span className={cn(marketingEyebrow, 'mx-auto mb-5')}>
              Early access pricing · September only
            </span>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-[var(--workspace-shell-text)] md:text-4xl">
              £14/month for your first 3 months. Everything included.
            </h2>
            <p
              className={`mx-auto mt-3 max-w-xl text-[var(--workspace-shell-text-muted)]`}
            >
              No limited version, no feature gates — every single thing on this
              page, including the email assistant and planner the moment
              they&apos;re ready.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-8 border-t border-dashed border-[color:var(--workspace-shell-border)] pt-6">
              <div className="min-w-40 text-left">
                <span className="mb-1.5 block text-[11px] font-medium tracking-[0.04em] text-[var(--workspace-shell-text-muted)] uppercase">
                  Extra seats
                </span>
                <span className="block text-[15px] font-bold text-[var(--workspace-shell-text)]">
                  £9/month each
                </span>
              </div>
              <div className="max-w-xs min-w-40 text-left">
                <span className="mb-1.5 block text-[11px] font-medium tracking-[0.04em] text-[var(--workspace-shell-text-muted)] uppercase">
                  After 3 months
                </span>
                <span className="block text-[15px] font-bold text-[var(--workspace-shell-text)]">
                  Pick what fits you, or stay on everything and keep 15% off,
                  for life
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className={cn(section, 'py-16 md:py-24')}>
          <SectionHeading
            eyebrow="Everything included"
            title="The whole business, not another app to juggle."
          />
          <EarlyAccessBentoGrid />
        </div>
      </section>

      <section>
        <div className={cn(featureTourSection, 'py-16 md:py-24')}>
          <SectionHeading
            eyebrow="A closer look"
            title="What it feels like in practice."
          />
          <FeatureTour />
        </div>
      </section>

      <section>
        <div className={cn(section, 'py-16 md:py-24')}>
          <SectionHeading
            eyebrow="Who it's for"
            title="Built for how you already freelance."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
            {EARLY_ACCESS_PERSONAS.map((persona) => (
              <div
                key={persona.title}
                className={cn(
                  marketingCard,
                  'flex h-full flex-col rounded-[1.5rem] p-5 md:p-6',
                )}
              >
                <span
                  className={cn(
                    'mb-3.5 block size-2.5 rounded-full',
                    EARLY_ACCESS_ACCENT_CLASS[persona.accent],
                  )}
                  aria-hidden
                />
                <p className="font-heading mb-2 text-base font-semibold text-[var(--workspace-shell-text)] lg:text-lg">
                  {persona.title}
                </p>
                <p
                  className={`mb-4 text-sm leading-relaxed ${marketingMutedText}`}
                >
                  {persona.desc}
                </p>
                <ul className="mt-auto space-y-2 border-t border-[color:var(--workspace-shell-border)] pt-4">
                  {persona.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-xs leading-snug text-[var(--workspace-shell-text)] lg:text-[13px]"
                    >
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-[var(--ozer-accent)]"
                        aria-hidden
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className={cn(section, 'py-16 md:py-20')}>
          <div
            className={cn(
              marketingCard,
              'mx-auto max-w-3xl rounded-[1.75rem] px-8 py-12 text-center md:px-10',
            )}
          >
            <span className="mb-4 block text-xs font-medium tracking-[0.05em] text-[var(--workspace-shell-text-muted)] uppercase">
              Already in use
            </span>
            <p className="font-heading mb-4 text-xl leading-relaxed font-medium text-[var(--workspace-shell-text)] italic md:text-2xl">
              &ldquo;One of Ozer&apos;s first partners — a small design studio —
              now runs their entire client operation through it, from first
              enquiry to final invoice.&rdquo;
            </p>
            <p className="text-sm font-semibold text-[var(--workspace-shell-text-muted)]">
              — Early partner studio
            </p>
          </div>
        </div>
      </section>

      <MarketingFaqsSection
        faqs={EARLY_ACCESS_FAQS.map((faq) => ({
          question: faq.question,
          answer: faq.answer,
        }))}
        tone="light"
        title="Questions people ask"
        headingId="early-access-faq-heading"
        headingAlign="center"
        sectionClassName="border-t border-[color:var(--workspace-shell-border)] py-16 md:py-24"
      />

      <section className="border-t border-[color:var(--workspace-shell-border)]">
        <div className={cn(section, 'py-16 text-center md:py-20')}>
          <h2 className="font-heading mb-8 text-3xl leading-tight font-semibold tracking-tight text-[var(--workspace-shell-text)] md:text-4xl">
            Ready to feel on top of it again?
          </h2>
          <EarlyAccessEmailCapture id="bottom-email" />
        </div>
      </section>
    </main>
  );
}
