import React from 'react';

import { cn } from '../../lib/utils';

interface BuiltForCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function BuiltForCard({
  icon,
  title,
  description,
  className,
}: BuiltForCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm transition-shadow hover:shadow-md dark:border-[#1e293b] dark:bg-[#1A253C]',
        className,
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#57C87F]/20 dark:bg-[#57C87F]/20">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  );
}

interface BuiltForGridProps {
  heading: string;
  subheading?: string;
  cards: Array<{
    icon: React.ReactNode;
    title: string;
    description: string;
  }>;
  className?: string;
}

export function BuiltForGrid({
  heading,
  subheading,
  cards,
  className,
}: BuiltForGridProps) {
  return (
    <section
      className={cn(
        'bg-white py-16 dark:bg-[#0D1421] lg:py-24',
        className,
      )}
    >
      <div className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
            {heading}
          </h2>
          {subheading && (
            <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
              {subheading}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {cards.map((card, index) => (
            <BuiltForCard
              key={index}
              icon={card.icon}
              title={card.title}
              description={card.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
