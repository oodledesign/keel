'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@kit/ui/accordion';
import { cn } from '@kit/ui/utils';

export type MarketingFaqItem = {
  question: string;
  answer: string;
};

/** Surface palette for FAQ accordions — same structure, different contrast pairs. */
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
    item: 'marketing-faq-item marketing-faq-item-muted',
    trigger: 'text-[var(--workspace-shell-text)]',
    content: 'text-[var(--workspace-shell-text-muted)]',
    heading: 'text-[var(--workspace-shell-text)]',
  },
  dark: {
    item: 'border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-on-dark-alpha-06)]',
    trigger: 'text-[var(--ozer-text-on-dark)]',
    content: 'text-[var(--ozer-text-on-dark-muted)]',
    heading: 'text-[var(--ozer-text-on-dark)]',
  },
};

export function MarketingFaqs({
  faqs,
  tone = 'light',
}: {
  faqs: MarketingFaqItem[];
  tone?: MarketingFaqTone;
}) {
  const styles = toneStyles[tone];

  return (
    <Accordion type="single" collapsible className="w-full space-y-3">
      {faqs.map((faq, index) => (
        <AccordionItem
          key={faq.question}
          value={`faq-${index}`}
          className={cn('border border-b-0 px-4', styles.item)}
        >
          <AccordionTrigger
            className={cn(
              'text-left text-base font-medium hover:no-underline [&>svg]:text-[var(--workspace-shell-text-muted)] dark:[&>svg]:text-[var(--ozer-text-on-dark-muted)]',
              styles.trigger,
              tone === 'dark' && '[&>svg]:text-[var(--ozer-text-on-dark-muted)]',
            )}
          >
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className={cn('text-sm leading-relaxed', styles.content)}>
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function MarketingFaqsSection({
  faqs,
  tone = 'light',
  title = 'Frequently asked questions',
  className,
  sectionClassName,
  headingId = 'marketing-faq-heading',
}: {
  faqs: MarketingFaqItem[];
  tone?: MarketingFaqTone;
  title?: string;
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
      className={cn('relative py-16', sectionClassName)}
      aria-labelledby={headingId}
    >
      <div className={cn('mx-auto w-full max-w-3xl px-6', className)}>
        <h2
          id={headingId}
          className={cn(
            'font-heading mb-8 text-3xl font-semibold tracking-tight md:text-4xl',
            styles.heading,
          )}
        >
          {title}
        </h2>
        <MarketingFaqs faqs={faqs} tone={tone} />
      </div>
    </section>
  );
}
