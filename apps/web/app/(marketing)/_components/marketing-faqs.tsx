'use client';

import type { ReactNode } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@kit/ui/accordion';
import { cn } from '@kit/ui/utils';

import { marketingSectionHeading } from '~/lib/marketing/marketing-ui';

import { MarketingSectionIndex } from './marketing-section-index';

export type MarketingFaqItem = {
  question: string;
  answer: string;
};

/** Surface palette for FAQ lists — same structure, different contrast pairs. */
export type MarketingFaqTone = 'light' | 'muted' | 'dark';

const toneStyles: Record<
  MarketingFaqTone,
  { item: string; trigger: string; content: string; heading: string }
> = {
  light: {
    item: 'marketing-faq-item',
    trigger: 'text-[var(--workspace-shell-text)]',
    content: 'text-[var(--workspace-shell-text-muted)]',
    heading: 'text-[var(--workspace-shell-text)]',
  },
  muted: {
    item: 'marketing-faq-item',
    trigger: 'text-[var(--workspace-shell-text)]',
    content: 'text-[var(--workspace-shell-text-muted)]',
    heading: 'text-[var(--workspace-shell-text)]',
  },
  dark: {
    item: 'marketing-faq-item marketing-faq-item-dark',
    trigger: 'text-[var(--ozer-text-on-dark)]',
    content: 'text-[var(--ozer-text-on-dark-muted)]',
    heading: 'text-[var(--ozer-text-on-dark)]',
  },
};

function PlusMinus() {
  return (
    <span
      className="relative ml-6 size-3.5 shrink-0 text-current opacity-70"
      aria-hidden="true"
    >
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-data-[state=open]:scale-y-0" />
    </span>
  );
}

export function MarketingFaqs({
  faqs,
  tone = 'light',
}: {
  faqs: MarketingFaqItem[];
  tone?: MarketingFaqTone;
}) {
  const styles = toneStyles[tone];

  return (
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq, index) => (
        <AccordionItem
          key={faq.question}
          value={`faq-${index}`}
          className={cn('border-b-0 last:border-b', styles.item)}
        >
          <AccordionTrigger
            className={cn(
              'group py-5 text-left text-[1.0625rem] font-medium hover:no-underline md:text-lg [&>svg]:hidden',
              styles.trigger,
            )}
          >
            {faq.question}
            <PlusMinus />
          </AccordionTrigger>
          <AccordionContent
            className={cn(
              'max-w-[40rem] pb-6 text-[0.9375rem] leading-relaxed',
              styles.content,
            )}
          >
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/**
 * Two-column FAQ: sticky serif heading on the left, hairline-divided
 * questions on the right.
 */
export function MarketingFaqsSection({
  faqs,
  tone = 'light',
  title = 'Frequently asked questions',
  index,
  label = 'Questions',
  intro,
  footer,
  className,
  sectionClassName,
  headingId = 'marketing-faq-heading',
}: {
  faqs: MarketingFaqItem[];
  tone?: MarketingFaqTone;
  title?: string;
  /** Section number for the index marker, e.g. "04". */
  index?: string;
  label?: string;
  intro?: ReactNode;
  /** Rendered under the heading, e.g. a link to the full FAQ page. */
  footer?: ReactNode;
  className?: string;
  sectionClassName?: string;
  headingId?: string;
}) {
  const styles = toneStyles[tone];

  if (faqs.length === 0) {
    return null;
  }

  return (
    <section
      className={cn('relative py-20 md:py-28', sectionClassName)}
      aria-labelledby={headingId}
    >
      <div className={cn('mx-auto w-full max-w-[88rem] px-6', className)}>
        <MarketingSectionIndex
          index={index}
          label={label}
          tone={tone === 'dark' ? 'dark' : 'light'}
        />
        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-10">
          <div className="lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
            <h2
              id={headingId}
              className={cn(marketingSectionHeading, styles.heading)}
            >
              {title}
            </h2>
            {intro ? (
              <p
                className={cn(
                  'mt-4 max-w-sm text-[0.9375rem] leading-relaxed',
                  styles.content,
                )}
              >
                {intro}
              </p>
            ) : null}
            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <MarketingFaqs faqs={faqs} tone={tone} />
          </div>
        </div>
      </div>
    </section>
  );
}
