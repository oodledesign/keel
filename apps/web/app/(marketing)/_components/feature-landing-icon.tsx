import type { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export function FeatureLandingIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = LucideIcons[
    name as keyof typeof LucideIcons
  ] as LucideIcon | undefined;

  if (!Icon) {
    return null;
  }

  return <Icon className={className} aria-hidden />;
}
