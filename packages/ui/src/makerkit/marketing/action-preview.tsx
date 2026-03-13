import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { Play } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../../shadcn/button';

interface ActionPreviewProps {
  heading: string;
  subheading?: string;
  videoThumbnail?: string;
  videoUrl?: string;
  overlayCard?: {
    title: string;
    description?: string;
    ctaLabel?: string;
    ctaHref?: string;
  };
  /** Alternative overlay: stacked feature items with icon, title, subtitle (e.g. Quick Setup, Team Collaboration). */
  overlayFeatures?: Array<{
    icon: React.ReactNode;
    title: string;
    subtitle: string;
  }>;
  className?: string;
}

export function ActionPreview({
  heading,
  subheading,
  videoThumbnail,
  videoUrl,
  overlayCard,
  overlayFeatures,
  className,
}: ActionPreviewProps) {
  return (
    <section className={cn('bg-gray-900 py-16 lg:py-24', className)}>
      <div className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
            {heading}
          </h2>
          {subheading && (
            <p className="mx-auto max-w-2xl text-lg text-white/90">
              {subheading}
            </p>
          )}
        </div>

        <div className="relative mx-auto max-w-5xl">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-[#3D4E5D] to-[#57C87F] shadow-2xl">
            {videoThumbnail ? (
              <Image
                src={videoThumbnail}
                alt={heading}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <Play className="ml-1 h-10 w-10 text-white" fill="white" />
                </div>
              </div>
            )}

            {videoUrl && (
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center"
                aria-label="Play video"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/30">
                  <Play className="ml-1 h-10 w-10 text-white" fill="white" />
                </div>
              </a>
            )}
          </div>

          {overlayFeatures && overlayFeatures.length > 0 ? (
            <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-[274px] rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 lg:right-8">
              <div className="flex flex-col gap-6">
                {overlayFeatures.map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#EAF7EC] text-[#57C87F]">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : overlayCard ? (
            <div className="absolute -right-4 top-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900 lg:right-8">
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                {overlayCard.title}
              </h3>
              {overlayCard.description && (
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  {overlayCard.description}
                </p>
              )}
              {overlayCard.ctaLabel && overlayCard.ctaHref && (
                <Button
                  asChild
                  className="h-9 rounded-lg bg-[#57C87F] px-4 text-sm font-semibold text-white hover:bg-[#57C87F]/90"
                >
                  <Link href={overlayCard.ctaHref}>
                    {overlayCard.ctaLabel}
                  </Link>
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
