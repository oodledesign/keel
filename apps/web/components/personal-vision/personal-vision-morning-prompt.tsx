'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { Telescope } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import pathsConfig from '~/config/paths.config';

import { usePersonalVisionChrome } from './personal-vision-chrome-context';

const STORAGE_PREFIX = 'ozer-vision-morning-prompt:';

function localDayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function markShownToday() {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${localDayKey()}`, '1');
  } catch {
    // ignore quota / private mode
  }
}

function wasShownToday(): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${localDayKey()}`) === '1';
  } catch {
    return true;
  }
}

/**
 * Once per local morning (calendar day), ask whether to open Personal Vision.
 * Only when settings allow it and the deck has playable content.
 */
export function PersonalVisionMorningPrompt() {
  const { morningPromptEnabled, hasContent } = usePersonalVisionChrome();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!morningPromptEnabled || !hasContent) return;
    if (wasShownToday()) return;

    // Defer slightly so the shell finishes painting.
    const timer = window.setTimeout(() => {
      if (wasShownToday()) return;
      setOpen(true);
      markShownToday();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [hasContent, morningPromptEnabled]);

  if (!morningPromptEnabled || !hasContent) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Telescope className="h-5 w-5 text-[var(--ozer-coral-500)]" />
            Morning Vision
          </DialogTitle>
          <DialogDescription>
            Take a minute with your Personal Vision before the day runs away?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Not now
          </Button>
          <Button
            asChild
            className="ozer-gradient-btn"
            onClick={() => setOpen(false)}
          >
            <Link href={pathsConfig.app.personalVision}>Open Vision</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
