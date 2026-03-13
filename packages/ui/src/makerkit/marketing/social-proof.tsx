import React from 'react';
import Image from 'next/image';

import { cn } from '../../lib/utils';

interface TestimonialCardProps {
  quote: string;
  author: {
    name: string;
    role: string;
    company?: string;
    avatar?: string;
  };
  className?: string;
}

export function TestimonialCard({
  quote,
  author,
  className,
}: TestimonialCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900',
        className,
      )}
    >
      <p className="mb-6 flex-1 text-gray-700 dark:text-gray-300">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="flex items-center gap-4">
        {author.avatar ? (
          <Image
            src={author.avatar}
            alt={author.name}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#57C87F]/20">
            <span className="text-lg font-semibold text-[#57C87F]">
              {author.name.charAt(0)}
            </span>
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {author.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {author.role}
            {author.company && ` at ${author.company}`}
          </p>
        </div>
      </div>
    </div>
  );
}

interface SocialProofProps {
  heading: string;
  subheading?: string;
  testimonials: Array<{
    quote: string;
    author: {
      name: string;
      role: string;
      company?: string;
      avatar?: string;
    };
  }>;
  className?: string;
}

export function SocialProof({
  heading,
  subheading,
  testimonials,
  className,
}: SocialProofProps) {
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

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={index}
              quote={testimonial.quote}
              author={testimonial.author}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
