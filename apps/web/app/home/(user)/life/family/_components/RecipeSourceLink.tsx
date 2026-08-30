import { ExternalLink } from 'lucide-react';

import { cn } from '@kit/ui/utils';

export function RecipeSourceLink({
  url,
  className,
}: {
  url: string | null | undefined;
  className?: string;
}) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-xs text-[var(--workspace-shell-text-muted)] underline-offset-2 hover:text-[var(--workspace-shell-text)] hover:underline',
        className,
      )}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      View original
    </a>
  );
}
