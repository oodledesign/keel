import type { SourcedValue } from '~/lib/marketing/compare/types';

const isDev = process.env.NODE_ENV === 'development';

export function SourcedText({
  sourced,
  format,
}: {
  sourced: SourcedValue<string | number>;
  format?: (value: string | number) => string;
}) {
  const display =
    format?.(sourced.value) ??
    (typeof sourced.value === 'number'
      ? sourced.value.toLocaleString('en-GB')
      : sourced.value);

  return (
    <span className="inline">
      {display}
      {!sourced.verified && isDev ? (
        <span
          className="ml-1 inline-flex items-center rounded bg-amber-200 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950"
          title={`Unverified — source: ${sourced.sourceUrl} (last marked ${sourced.lastVerified})`}
        >
          verify me
        </span>
      ) : null}
    </span>
  );
}

export function formatGbpYear(amount: number): string {
  return `£${amount.toLocaleString('en-GB')}/year`;
}

export function formatGbp(amount: number): string {
  return `£${amount.toLocaleString('en-GB')}`;
}
