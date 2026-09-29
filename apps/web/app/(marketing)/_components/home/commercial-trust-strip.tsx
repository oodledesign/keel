import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import { COMMERCIAL_HOME_TRUST } from '~/lib/marketing/commercial-home-content';
import {
  marketingIconWell,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

import { FeatureLandingIcon } from '../feature-landing-icon';

export function CommercialTrustStrip() {
  return (
    <section
      className="border-y border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
      aria-label="Security and pricing"
    >
      <ul className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {COMMERCIAL_HOME_TRUST.map((item) => {
          const content = (
            <>
              <span className={cn(marketingIconWell, 'size-10 shrink-0')}>
                <FeatureLandingIcon name={item.icon} className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[var(--workspace-shell-text)]">
                  {item.title}
                </span>
                <span
                  className={cn(
                    'mt-1 block text-sm leading-relaxed',
                    marketingMutedText,
                  )}
                >
                  {item.description}
                </span>
              </span>
            </>
          );

          return (
            <li key={item.title}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="-m-2 flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex items-start gap-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
