import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

type Props = {
  heading: string;
  subheading?: string;
  cta: {
    label: string;
    href: string;
  };
  className?: string;
};

/** Coral mesh CTA band — homepage closing strip. */
export function MarketingFinalCta({
  heading,
  subheading,
  cta,
  className,
}: Props) {
  return (
    <section className={cn('px-6 py-10 md:py-14', className)}>
      <div
        className={cn(
          'relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] px-6 py-14 text-center md:rounded-[2.5rem] md:px-12 md:py-20',
          'bg-[linear-gradient(115deg,var(--ozer-coral-600)_0%,var(--ozer-coral-500)_42%,var(--ozer-coral-400)_78%,#ffb48c_100%)]',
          'shadow-[0_24px_60px_var(--ozer-coral-alpha-45)]',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: [
              'radial-gradient(ellipse 70% 80% at 12% 40%, rgba(255,255,255,0.28), transparent 55%)',
              'radial-gradient(ellipse 50% 60% at 88% 30%, rgba(255,224,214,0.45), transparent 50%)',
              'radial-gradient(ellipse 40% 50% at 70% 90%, rgba(194,69,42,0.35), transparent 55%)',
            ].join(','),
          }}
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-heading text-3xl leading-tight font-bold text-[var(--ozer-cream-50)] md:text-4xl lg:text-[2.75rem]">
            {heading}
          </h2>
          {subheading ? (
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--ozer-cream-50)]/90 md:text-lg">
              {subheading}
            </p>
          ) : null}
          <Button
            asChild
            size="lg"
            className={cn(
              'mt-8 h-12 rounded-full border-0 bg-[var(--ozer-cream-50)] px-8 text-base font-semibold text-[var(--ozer-plum-950)]',
              'hover:bg-white hover:text-[var(--ozer-plum-950)]',
              'transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]',
            )}
          >
            <Link href={cta.href}>
              {cta.label}
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
