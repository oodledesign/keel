import { cn } from '@kit/ui/utils';

import {
  marketingLede,
  marketingSectionHeading,
} from '~/lib/marketing/marketing-ui';

export function SitePageHeader({
  title,
  subtitle,
  container = true,
  className = '',
}: {
  title: string;
  subtitle: string;
  container?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'pt-16 md:pt-24',
        container && 'mx-auto w-full max-w-[88rem] px-6',
        className,
      )}
    >
      <div className="marketing-rule grid gap-6 border-b pb-10 md:grid-cols-12 md:gap-8 md:pb-14">
        <h1
          className={cn(
            marketingSectionHeading,
            'text-[var(--workspace-shell-text)] md:col-span-7 md:text-[3.5rem]',
          )}
        >
          {title}
        </h1>

        <p
          className={cn(
            marketingLede,
            'self-end text-[var(--workspace-shell-text-muted)] md:col-span-5',
          )}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
