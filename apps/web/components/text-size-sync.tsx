'use client';

import { useEffect } from 'react';

import { getAccessibilityPreferencesForSync } from '../app/onboarding/_lib/server/onboarding.actions';

const TEXT_SIZE_COOKIE = 'accessibility_text_size';
const DYSLEXIA_FONT_COOKIE = 'accessibility_dyslexia_font';
const ENHANCED_FOCUS_COOKIE = 'accessibility_enhanced_focus';
const VALID = ['small', 'standard', 'large'] as const;
const TEXT_SIZE_CLASSES = ['text-size-small', 'text-size-standard', 'text-size-large'] as const;
const DYSLEXIA_ATTR = 'data-dyslexia-font';
const ENHANCED_FOCUS_ATTR = 'data-enhanced-focus';

function getTextSizeClassFromCookie(): (typeof TEXT_SIZE_CLASSES)[number] {
  if (typeof document === 'undefined') return 'text-size-standard';
  const match = document.cookie
    .split('; ')
    .find((row) => row.trimStart().startsWith(`${TEXT_SIZE_COOKIE}=`));
  const raw = match?.split('=').slice(1).join('=').trim();
  const value = raw?.replace(/^"|"$/g, '');
  if (value && (VALID as readonly string[]).includes(value))
    return `text-size-${value}` as (typeof TEXT_SIZE_CLASSES)[number];
  return 'text-size-standard';
}

function getDyslexiaEnabledFromCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const match = document.cookie
    .split('; ')
    .find((row) => row.trimStart().startsWith(`${DYSLEXIA_FONT_COOKIE}=`));
  const raw = match?.split('=').slice(1).join('=').trim();
  return raw === '1' || raw === 'true';
}

function getEnhancedFocusFromCookie(): boolean {
  if (typeof document === 'undefined') return true;
  const match = document.cookie
    .split('; ')
    .find((row) => row.trimStart().startsWith(`${ENHANCED_FOCUS_COOKIE}=`));
  const raw = match?.split('=').slice(1).join('=').trim();
  if (raw === '0' || raw === 'false') return false;
  return true;
}

function applyAccessibility(prefs?: {
  textSize: 'small' | 'standard' | 'large';
  dyslexiaFont: boolean;
  enhancedFocus: boolean;
} | null) {
  const root = document.documentElement;
  const textSizeClass = prefs
    ? `text-size-${prefs.textSize}`
    : getTextSizeClassFromCookie();
  const dyslexia = prefs ? prefs.dyslexiaFont : getDyslexiaEnabledFromCookie();
  const enhancedFocus = prefs ? prefs.enhancedFocus : getEnhancedFocusFromCookie();
  TEXT_SIZE_CLASSES.forEach((c) => root.classList.remove(c));
  root.classList.add(textSizeClass);
  if (dyslexia) root.setAttribute(DYSLEXIA_ATTR, 'true');
  else root.removeAttribute(DYSLEXIA_ATTR);
  if (enhancedFocus) root.setAttribute(ENHANCED_FOCUS_ATTR, 'true');
  else root.removeAttribute(ENHANCED_FOCUS_ATTR);
}

export const ACCESSIBILITY_UPDATED_EVENT = 'accessibility-updated';

export function TextSizeSync() {
  useEffect(() => {
    const apply = (prefs?: { textSize: 'small' | 'standard' | 'large'; dyslexiaFont: boolean; enhancedFocus: boolean } | null) => {
      applyAccessibility(prefs ?? null);
    };
    apply(null);
    const raf = requestAnimationFrame(() => apply(null));
    let cancelled = false;
    getAccessibilityPreferencesForSync().then((prefs) => {
      if (!cancelled) apply(prefs ?? null);
    });
    const t1 = setTimeout(() => apply(null), 100);
    const t2 = setTimeout(() => apply(null), 400);
    const handler = () => requestAnimationFrame(() => apply(null));
    window.addEventListener(ACCESSIBILITY_UPDATED_EVENT, handler);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener(ACCESSIBILITY_UPDATED_EVENT, handler);
    };
  }, []);
  return null;
}
