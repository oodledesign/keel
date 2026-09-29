import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import { COMMERCIAL_HOME_TRUST } from '~/lib/marketing/commercial-home-content';
import {
  marketingMutedText,
  marketingRule,
} from '~/lib/marketing/marketing-ui';

export function CommercialTrustStrip() {
  return (
    <section
      className="mx-auto w-full max-w-[88rem] px-6"
      aria-label="Security and pricing"
    >
      <ul
        className={cn(
          marketingRule,
          'grid border-y sm:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {COMMERCIAL_HOME_TRUST.map((item) => {
          const content = (
            <>
              <span className="block text-[0.9375rem] font-medium text-[var(--workspace-shell-text)]">
                {item.title}
                {item.href ? (
                  <span
                    className="ml-1.5 text-[var(--workspace-shell-text-muted)] transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  >
                    →
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  'mt-1.5 block text-sm leading-relaxed',
                  marketingMutedText,
                )}
              >
                {item.description}
              </span>
            </>
          );

          return (
            <li
              key={item.title}
              className={cn(
                marketingRule,
                'border-t py-7 first:border-t-0 lg:border-t-0 lg:border-l lg:px-6 lg:first:border-l-0 lg:first:pl-0 sm:[&:nth-child(2)]:border-t-0',
              )}
            >
              {item.href ? (
                <Link
                  href={item.href}
                  className="group block rounded-[2px] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none"
                >
                  {content}
                </Link>
              ) : (
                <div>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
