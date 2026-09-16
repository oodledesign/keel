'use client';

import { createElement } from 'react';

import { surveySectionIcon } from '~/lib/building-surveyor/survey-section-icons';

export function SurveySectionHeadingIcon({
  sectionKey,
  className,
}: {
  sectionKey?: string;
  className?: string;
}) {
  return createElement(surveySectionIcon(sectionKey ?? ''), {
    className,
    'aria-hidden': true,
  });
}
