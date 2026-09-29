import { COMMERCIAL_HOME_PROOF } from '~/lib/marketing/commercial-home-content';
import { marketingRule } from '~/lib/marketing/marketing-ui';

/** Pull quote from a signed-off customer. Renders nothing until one exists. */
export function CommercialProofQuote() {
  const proof = COMMERCIAL_HOME_PROOF;

  if (!proof) {
    return null;
  }

  return (
    <section
      className="mx-auto w-full max-w-[88rem] px-6 pt-20 md:pt-28"
      aria-label="Customer quote"
    >
      <figure
        className={`${marketingRule} border-t pt-10 lg:grid lg:grid-cols-12 lg:gap-10`}
      >
        <blockquote className="font-heading text-[1.75rem] leading-[1.2] font-medium tracking-[-0.015em] text-[var(--workspace-shell-text)] md:text-[2.5rem] lg:col-span-9">
          “{proof.quote}”
        </blockquote>
        <figcaption className="mt-6 text-sm text-[var(--workspace-shell-text-muted)] lg:col-span-3 lg:mt-2">
          {proof.name}, {proof.role}
          <br />
          {proof.agency}
        </figcaption>
      </figure>
    </section>
  );
}
