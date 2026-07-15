'use client';

import { CtaButton, SectionShell } from '@kit/site-blocks-core';

export type TemplateFeatureBandProps = {
  eyebrow?: string;
  heading?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  items?: Array<{ title?: string; description?: string }>;
};

/**
 * Example custom block for the round-trip workflow.
 *
 * Conventions for Cursor-built blocks:
 * - Style with `--sb-*` tokens (never hard-coded brand colours) so the
 *   block follows the site's design tokens.
 * - Use `SectionShell` for consistent section spacing / max-width.
 * - Every prop a client should edit in Puck must appear in
 *   `block.manifest.json` with a matching key.
 */
export function TemplateFeatureBand(props: TemplateFeatureBandProps) {
  const items = props.items ?? [];

  return (
    <SectionShell tone="surface">
      <div className="grid gap-[var(--sb-space-8)] md:grid-cols-2 md:items-center">
        <div className="space-y-[var(--sb-space-4)]">
          {props.eyebrow ? (
            <p className="text-xs font-medium tracking-widest text-[var(--sb-color-primary)] uppercase">
              {props.eyebrow}
            </p>
          ) : null}
          <h2 className="text-3xl font-semibold text-[var(--sb-ink)]">
            {props.heading}
          </h2>
          {props.body ? (
            <p className="text-[var(--sb-ink-muted)]">{props.body}</p>
          ) : null}
          {props.ctaLabel ? (
            props.ctaHref ? (
              <a href={props.ctaHref}>
                <CtaButton label={props.ctaLabel} />
              </a>
            ) : (
              <CtaButton label={props.ctaLabel} />
            )
          ) : null}
        </div>

        <ul className="space-y-[var(--sb-space-4)]">
          {items.map((item, index) => (
            <li
              // Puck array items have no stable ids; index is the least-bad key.
              key={index}
              className="rounded-[var(--sb-radius-md)] border border-[var(--sb-border)] bg-[var(--sb-canvas)] p-[var(--sb-space-4)]"
            >
              <p className="font-medium text-[var(--sb-ink)]">{item.title}</p>
              {item.description ? (
                <p className="mt-1 text-sm text-[var(--sb-ink-muted)]">
                  {item.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
