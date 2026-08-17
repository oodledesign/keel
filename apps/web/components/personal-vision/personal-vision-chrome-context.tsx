'use client';

import { type ReactNode, createContext, useContext, useMemo } from 'react';

import type { PersonalVisionChromeFlags } from '~/lib/personal-vision/personal-vision-chrome.types';

export type { PersonalVisionChromeFlags };

const DEFAULT_FLAGS: PersonalVisionChromeFlags = {
  showIcon: false,
  morningPromptEnabled: false,
  hasContent: false,
};

const PersonalVisionChromeContext =
  createContext<PersonalVisionChromeFlags>(DEFAULT_FLAGS);

export function PersonalVisionChromeProvider({
  value,
  children,
}: {
  value: PersonalVisionChromeFlags;
  children: ReactNode;
}) {
  const memo = useMemo(
    () => ({
      showIcon: value.showIcon,
      morningPromptEnabled: value.morningPromptEnabled,
      hasContent: value.hasContent,
    }),
    [value.hasContent, value.morningPromptEnabled, value.showIcon],
  );

  return (
    <PersonalVisionChromeContext.Provider value={memo}>
      {children}
    </PersonalVisionChromeContext.Provider>
  );
}

export function usePersonalVisionChrome(): PersonalVisionChromeFlags {
  return useContext(PersonalVisionChromeContext);
}
