'use client';

import React from 'react';
import Link from 'next/link';

import { cn } from '../../lib/utils';
import { Button } from '../../shadcn/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../shadcn/accordion';

interface FAQItemProps {
  question: string;
  answer: string;
  value: string;
}

export function FAQItem({ question, answer, value }: FAQItemProps) {
  return (
    <AccordionItem value={value} className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <AccordionTrigger className="px-6 py-4 text-left font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-gray-800">
        {question}
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6 pt-2">
        <p className="text-gray-600 dark:text-gray-400">{answer}</p>
      </AccordionContent>
    </AccordionItem>
  );
}

interface FAQSectionProps {
  heading: string;
  subheading?: string;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}

export function FAQSection({
  heading,
  subheading,
  faqs,
  viewAllHref,
  viewAllLabel,
  className,
}: FAQSectionProps) {
  return (
    <section className={cn('py-16 lg:py-24', className)}>
      <div className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
            {heading}
          </h2>
          {subheading && (
            <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
              {subheading}
            </p>
          )}
        </div>

        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                value={`item-${index}`}
                question={faq.question}
                answer={faq.answer}
              />
            ))}
          </Accordion>
          {viewAllHref && viewAllLabel && (
            <div className="mt-6 text-center">
              <Button asChild variant="outline" size="sm">
                <Link href={viewAllHref}>{viewAllLabel}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
