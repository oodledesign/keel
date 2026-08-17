'use client';

import Link from 'next/link';

import { Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@kit/ui/tooltip';

import pathsConfig from '~/config/paths.config';

import { usePersonalVisionChrome } from './personal-vision-chrome-context';

type Props = {
  className?: string;
};

export function PersonalVisionTopBarIcon({ className }: Props) {
  const { showIcon } = usePersonalVisionChrome();
  if (!showIcon) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          type="button"
          variant="ghost"
          size="icon"
          className={
            className ??
            'h-8 w-8 rounded-md text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]'
          }
        >
          <Link
            href={pathsConfig.app.personalVision}
            aria-label="Personal Vision"
          >
            <Sparkles className="h-4 w-4" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Personal Vision</TooltipContent>
    </Tooltip>
  );
}
