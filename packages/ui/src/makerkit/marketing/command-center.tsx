'use client';

import React, { useState } from 'react';
import Image from 'next/image';

import { cn } from '../../lib/utils';

interface CommandCenterProps {
  heading: string;
  subheading?: string;
  dashboardImage: string;
  dashboardAlt?: string;
  /** Tab labels for dashboard views (e.g. Projects view, Team view, Invoices View). When set, no overlay is shown. */
  dashboardTabs?: string[];
  className?: string;
}

export function CommandCenter({
  heading,
  subheading,
  dashboardImage,
  dashboardAlt = 'Dashboard',
  dashboardTabs,
  className,
}: CommandCenterProps) {
  const [activeTab, setActiveTab] = useState(0);

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

        <div className="mx-auto max-w-6xl overflow-hidden rounded-lg border border-gray-200 shadow-2xl dark:border-gray-800">
          {dashboardTabs && dashboardTabs.length > 0 && (
            <div className="flex border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              {dashboardTabs.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    'px-6 py-3 text-sm font-medium transition-colors',
                    activeTab === i
                      ? 'border-b-2 border-[#57C87F] text-[#57C87F] bg-white dark:bg-gray-900 dark:text-[#57C87F]'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-hidden">
            <Image
              src={dashboardImage}
              alt={dashboardAlt}
              width={1200}
              height={800}
              className="w-full"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
