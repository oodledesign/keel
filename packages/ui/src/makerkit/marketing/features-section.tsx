import React from 'react';
import Link from 'next/link';

import { ArrowRight, CheckCircle2 } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../../shadcn/button';

interface FeatureItemProps {
  icon: React.ReactNode;
  iconColor?: string;
  title: string;
  description: string;
  features: string[];
  className?: string;
}

export function FeatureItem({
  icon,
  iconColor = '#57C87F',
  title,
  description,
  features,
  className,
}: FeatureItemProps) {
  return (
    <div
      className={cn(
        'flex gap-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900',
        className,
      )}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${iconColor}20` }}
      >
        <div style={{ color: iconColor }}>{icon}</div>
      </div>
      <div className="flex-1">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: iconColor }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface FeaturesSectionProps {
  heading: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  features: Array<{
    icon: React.ReactNode;
    iconColor?: string;
    title: string;
    description: string;
    features: string[];
  }>;
  className?: string;
}

export function FeaturesSection({
  heading,
  description,
  ctaLabel,
  ctaHref,
  features,
  className,
}: FeaturesSectionProps) {
  return (
    <section className={cn('py-16 lg:py-24', className)}>
      <div className="container mx-auto">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column */}
          <div className="flex flex-col justify-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
              {heading}
            </h2>
            <p className="mb-8 text-lg text-gray-600 dark:text-gray-400">
              {description}
            </p>
            {ctaLabel && ctaHref && (
              <Button
                asChild
                className="w-fit rounded-lg bg-[#57C87F] px-6 py-6 text-base font-semibold text-white hover:bg-[#57C87F]/90"
              >
                <Link href={ctaHref}>
                  {ctaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {features.map((feature, index) => (
              <FeatureItem
                key={index}
                icon={feature.icon}
                iconColor={feature.iconColor}
                title={feature.title}
                description={feature.description}
                features={feature.features}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
