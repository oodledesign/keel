import { Check } from 'lucide-react';

import { CommercialSeatCalculator } from '~/(marketing)/_components/commercial-seat-calculator';
import { getCommercialPricingData } from '~/lib/marketing/commercial-home-content';

export function CommercialPricingTeaser() {
  const pricing = getCommercialPricingData();

  return (
    <section
      id="pricing"
      className="w-full scroll-mt-24 bg-[var(--ozer-cream-50)] py-20 md:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto w-full max-w-[88rem] px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-14">
          {/* Left Column: Published Bands & Inclusions */}
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold tracking-wider text-[var(--workspace-shell-text-muted)] uppercase">
              {pricing.eyebrow}
            </p>
            <h2
              id="pricing-heading"
              className="font-heading mt-2 text-3xl font-semibold tracking-tight text-[var(--workspace-shell-text)] sm:text-4xl lg:text-5xl"
            >
              {pricing.heading}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--workspace-shell-text-muted)]">
              {pricing.body}
            </p>

            {/* Three Simple Bands */}
            <div className="mt-8 flex flex-wrap gap-3">
              {pricing.bands.map((band) => (
                <div
                  key={band.label}
                  className="flex items-center gap-2 rounded-full border border-[color:var(--workspace-shell-border)] bg-white px-4 py-2.5 shadow-sm"
                >
                  <span className="text-xs font-semibold text-[var(--workspace-shell-text-muted)]">
                    {band.label}
                  </span>
                  <span className="text-sm font-bold text-[var(--workspace-shell-text)]">
                    · {band.price}
                  </span>
                </div>
              ))}
            </div>

            {/* Inclusions Line */}
            <div className="mt-8 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <Check className="size-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wider text-[var(--workspace-shell-text)] uppercase">
                    Included in every seat
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--workspace-shell-text-muted)]">
                    {pricing.inclusions}
                  </p>
                </div>
              </div>
            </div>

            {/* Support Seats Line */}
            <p className="mt-5 text-xs text-[var(--workspace-shell-text-muted)]">
              {pricing.supportLine}
            </p>
          </div>

          {/* Right Column: "Your Plan" Interactive Slider */}
          <div className="lg:col-span-6">
            <CommercialSeatCalculator />
          </div>
        </div>
      </div>
    </section>
  );
}
