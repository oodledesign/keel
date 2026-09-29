import Image from 'next/image';

import { cn } from '@kit/ui/utils';

import {
  COMMERCIAL_HOME_PROOF,
  COMMERCIAL_HOME_PUBLISH_PORTALS,
} from '~/lib/marketing/commercial-home-content';
import {
  marketingSectionDark,
  marketingSectionDarkMuted,
} from '~/lib/marketing/marketing-ui';

export function CommercialProofStrip() {
  const proof = COMMERCIAL_HOME_PROOF;

  return (
    <section
      className={cn(
        'relative z-10 border-t border-[color:var(--ozer-border-on-dark)]',
        marketingSectionDark,
      )}
      aria-label="Portal integrations"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-6 py-8 md:flex-row md:justify-between">
        <p
          className={cn(
            'text-xs font-medium tracking-[0.14em] uppercase',
            marketingSectionDarkMuted,
          )}
        >
          Publishes to
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {COMMERCIAL_HOME_PUBLISH_PORTALS.map((portal) => (
            <li key={portal.name}>
              <Image
                src={portal.logoSrc}
                alt={`${portal.name} logo`}
                width={160}
                height={40}
                unoptimized
                className="h-8 w-auto max-w-[10rem] object-contain md:h-9"
              />
            </li>
          ))}
        </ul>
      </div>

      {proof ? (
        <figure className="mx-auto w-full max-w-3xl px-6 pb-10 text-center">
          <blockquote className="font-heading text-xl leading-snug text-[var(--ozer-text-on-dark)] md:text-2xl">
            “{proof.quote}”
          </blockquote>
          <figcaption className={cn('mt-3 text-sm', marketingSectionDarkMuted)}>
            {proof.name}, {proof.role} · {proof.agency}
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}
