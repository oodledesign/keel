import Link from 'next/link';

import { Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { loadPersonalVisionDashboardEnabled } from '~/lib/personal-vision/personal-vision.loader';

type Props = {
  className?: string;
  compact?: boolean;
};

export async function PersonalVisionDashboardLaunch({
  className,
  compact,
}: Props) {
  const enabled = await loadPersonalVisionDashboardEnabled();
  if (!enabled) return null;

  return (
    <div className={cn(className)}>
      <Button
        asChild
        size={compact ? 'sm' : 'default'}
        className="ozer-gradient-btn"
      >
        <Link href={pathsConfig.app.personalVision}>
          <Sparkles className="mr-2 h-4 w-4" />
          Personal Vision
        </Link>
      </Button>
    </div>
  );
}
