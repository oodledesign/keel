import { cn } from '@kit/ui/utils';

import { MarketingFaqs } from '~/(marketing)/_components/marketing-faqs';
import { EarlyAccessBentoGrid } from '~/(marketing)/early-access/_components/early-access-bento-grid';
import { EarlyAccessEmailCapture } from '~/(marketing)/early-access/_components/early-access-email-capture';
import { EarlyAccessFeatureMock } from '~/(marketing)/early-access/_components/early-access-feature-mocks';
import {
  EARLY_ACCESS_ACCENT_CLASS,
  EARLY_ACCESS_ACCENT_SOFT_CLASS,
  EARLY_ACCESS_FAQS,
  EARLY_ACCESS_FEATURE_BLOCKS,
  EARLY_ACCESS_PERSONAS,
  EARLY_ACCESS_PILL_CHAIN,
} from '~/lib/marketing/early-access-content';
import {
  marketingCard,
  marketingEyebrow,
  marketingMutedText,
  marketingSectionHeading,
} from '~/lib/marketing/marketing-ui';

function PillChain() {
  return (
    <div
      className="relative mx-auto mb-12 flex max-w-xl flex-wrap justify-center gap-5 pt-2 md:gap-7"
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
    <div className="mb-10 text-center md:mb-14">
      <p className="mb-2 text-[13px] font-medium tracking-[0.06em] text-[var(--workspace-shell-text-muted)] uppercase">
        {eyebrow}
      </p>
      <h2
        className={cn(
          marketingSectionHeading,
          'mx-auto max-w-xl text-[var(--workspace-shell-text)]',
        )}
      >
        {title}
      </h2>
    </div>
  );
}

export function EarlyAccessLanding() {
  return (
    <main className="marketing-shell">
      <header className="mx-auto max-w-[67.5rem] px-6 pt-14 pb-16 text-center md:pt-20 md:pb-20">
        <span className={cn(marketingEyebrow, 'mx-auto mb-7 self-center')}>
          <span
            className="mr-2 inline-block size-1.5 rounded-full bg-[var(--ozer-sage-500)]"
            aria-hidden
          />
          Early access — now onboarding a small group of freelancers &amp;
          studios
        </span>

        <h1 className="font-heading mx-auto mb-5 max-w-[47.5rem] text-[clamp(2.125rem,5.4vw,3.625rem)] leading-[1.06] font-bold tracking-tight text-[var(--workspace-shell-text)]">
          One workspace for your whole freelance business.
        </h1>

        <p
          className={`mx-auto mb-10 max-w-[32.5rem] text-lg leading-relaxed ${marketingMutedText}`}
        >
          Ozer brings your clients, invoices, projects and notes into one place
          — so you stop stitching your business together from six different
          tools.
        </p>

        <PillChain />

        <div id="join">
          <EarlyAccessEmailCapture id="hero-email" />
          <p className="mt-4 text-[13px] text-[var(--workspace-shell-text-muted)]">
            No spam. We read every reply and onboard people ourselves.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[67.5rem] px-6 pb-20 md:pb-24">
        <div
          className={cn(
            marketingCard,
            'mx-auto max-w-[45rem] rounded-3xl px-8 py-11 text-center md:px-9',
          )}
        >
          <span className={cn(marketingEyebrow, 'mx-auto mb-5 self-center')}>
            Early access pricing · September only
          </span>
          <h2 className="font-heading mb-3.5 text-[clamp(1.5rem,3.2vw,2rem)] font-bold tracking-tight text-[var(--workspace-shell-text)]">
            £14/month for your first 3 months. Everything included.
          </h2>
          <p
            className={`mx-auto max-w-[30rem] text-[15px] leading-relaxed ${marketingMutedText}`}
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
                Pick what fits you, or stay on everything and keep 15% off, for
                life
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[67.5rem] px-6 pb-20 md:pb-24">
        <SectionHeading
          eyebrow="Everything included"
          title="One workspace, all your tools."
        />
        <EarlyAccessBentoGrid />
      </section>

      <section className="mx-auto max-w-[67.5rem] px-6 py-10 pb-20 md:pb-24">
        <SectionHeading
          eyebrow="A closer look"
          title="How the core of it works."
        />

        <div>
          {EARLY_ACCESS_FEATURE_BLOCKS.map((block) => (
            <div
              key={block.eyebrow}
              className={cn(
                'grid items-center gap-6 border-t border-[color:var(--workspace-shell-border)] py-8 md:grid-cols-2 md:gap-12 md:py-11',
                'last:border-b',
                block.soon && 'opacity-95',
              )}
            >
              <div className={cn(block.reverse && 'md:order-2')}>
                <span className="mb-3.5 inline-flex items-center gap-2 text-xs font-medium text-[var(--workspace-shell-text-muted)]">
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      EARLY_ACCESS_ACCENT_CLASS[block.accent],
                    )}
                    aria-hidden
                  />
                  {block.eyebrow}
                </span>
                <h3 className="font-heading mb-3 text-[1.625rem] font-bold tracking-tight text-[var(--workspace-shell-text)]">
                  {block.title}
                </h3>
                <p
                  className={`max-w-[25rem] text-base leading-relaxed ${marketingMutedText}`}
                >
                  {block.desc}
                </p>
                {block.soon ? (
                  <span
                    className={cn(
                      'mt-4 inline-block rounded-full px-3.5 py-1.5 text-xs font-bold',
                      EARLY_ACCESS_ACCENT_SOFT_CLASS[block.accent],
                    )}
                  >
                    Included in testing — unlocks automatically when ready
                  </span>
                ) : null}
              </div>
              <div className={cn(block.reverse && 'md:order-1')}>
                <EarlyAccessFeatureMock
                  type={block.mock}
                  accent={block.accent}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[67.5rem] px-6 pb-20 md:pb-24">
        <SectionHeading
          eyebrow="Who it's for"
          title="Built for how you already freelance."
        />
        <div className="mx-auto grid max-w-[55rem] grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {EARLY_ACCESS_PERSONAS.map((persona) => (
            <div
              key={persona.title}
              className={cn(
                marketingCard,
                'rounded-[1.125rem] p-6',
                persona.wide && 'sm:col-span-2',
              )}
            >
              <span
                className={cn(
                  'mb-3.5 block size-2.5 rounded-full',
                  EARLY_ACCESS_ACCENT_CLASS[persona.accent],
                )}
                aria-hidden
              />
              <p className="mb-2 text-[15px] font-extrabold text-[var(--workspace-shell-text)]">
                {persona.title}
              </p>
              <p className={`text-sm leading-relaxed ${marketingMutedText}`}>
                {persona.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[67.5rem] px-6 pb-20 md:pb-24">
        <div
          className={cn(
            marketingCard,
            'mx-auto max-w-[42.5rem] rounded-3xl px-8 py-12 text-center',
          )}
        >
          <span className="mb-4 block text-xs font-medium tracking-[0.05em] text-[var(--workspace-shell-text-muted)] uppercase">
            Already in use
          </span>
          <p className="font-heading mb-4 text-[1.375rem] leading-relaxed font-medium text-[var(--workspace-shell-text)] italic">
            &ldquo;One of Ozer&apos;s first partners — a small design studio —
            now runs their entire client operation through it, from first
            enquiry to final invoice.&rdquo;
          </p>
          <p className="text-[13px] font-bold text-[var(--workspace-shell-text-muted)]">
            — Early partner studio
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[67.5rem] px-6 pb-20 md:pb-24">
        <SectionHeading
          eyebrow="Before you sign up"
          title="Questions people ask"
        />
        <div className="mx-auto max-w-[42.5rem]">
          <MarketingFaqs
            faqs={EARLY_ACCESS_FAQS.map((faq) => ({
              question: faq.question,
              answer: faq.answer,
            }))}
            tone="light"
          />
        </div>
      </section>

      <section className="mx-auto max-w-[67.5rem] border-t border-[color:var(--workspace-shell-border)] px-6 py-16 text-center md:py-20">
        <h2 className="font-heading mx-auto mb-8 max-w-[30rem] text-[clamp(1.625rem,3.6vw,2.375rem)] font-bold tracking-tight text-[var(--workspace-shell-text)]">
          Ready to run your business from one place?
        </h2>
        <EarlyAccessEmailCapture id="bottom-email" />
      </section>
    </main>
  );
}
