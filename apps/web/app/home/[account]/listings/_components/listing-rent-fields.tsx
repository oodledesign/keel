'use client';

import { AlertTriangle } from 'lucide-react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@kit/ui/input-group';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

import {
  RENT_BASIS_OPTIONS,
  RENT_WARNING_TEXT,
  annualRentPounds,
  describeRightmoveRent,
  formatAnnualRent,
  formatRent,
  rentBasis,
  rentBasisUnit,
  rentWarnings,
  rightmoveRent,
} from '~/lib/commercial/listing-rent';

type RentFormValues = {
  askingRent: string;
  askingRentTo: string;
  rentFrequency: string;
  hideRentFromMarketing: boolean;
  sizeMinSqft: string;
  sizeMaxSqft: string;
};

function pence(value: string): number | null {
  const pounds = parseFloat(value);
  return Number.isFinite(pounds) ? Math.round(pounds * 100) : null;
}

function number(value: string): number | null {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Asking rent with how it is quoted, and a preview of what it works out at
 * and how Rightmove will show it.
 */
export function ListingRentFields({
  values,
  showRightmove,
  inputClassName,
  onChange,
}: {
  values: RentFormValues;
  /** Lettings disposals go to Rightmove with this rent. */
  showRightmove: boolean;
  inputClassName?: string;
  onChange: (patch: Partial<RentFormValues>) => void;
}) {
  const basis = rentBasis(values.rentFrequency);
  const unit = rentBasisUnit(basis);
  const rent = {
    askingRentPence: pence(values.askingRent),
    askingRentToPence: pence(values.askingRentTo),
    rentFrequency: basis,
    sizeMinSqft: number(values.sizeMinSqft),
    sizeMaxSqft: number(values.sizeMaxSqft),
  };
  const quoted = formatRent(
    rent.askingRentPence,
    rent.askingRentToPence,
    basis,
  );
  const annual = annualRentPounds(rent);
  const warnings = rentWarnings(rent);
  const rightmove = describeRightmoveRent(
    rightmoveRent({ ...rent, hideRent: values.hideRentFromMarketing }),
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label
          id="listing-rent-basis-label"
          className="text-[var(--workspace-shell-text)]/70"
        >
          Rent is quoted
        </Label>
        <div
          role="radiogroup"
          aria-labelledby="listing-rent-basis-label"
          className="inline-flex rounded-md border border-[color:var(--workspace-shell-border)] p-0.5"
        >
          {RENT_BASIS_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={basis === option.id}
              onClick={() => onChange({ rentFrequency: option.id })}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                basis === option.id
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                  : 'text-[var(--workspace-shell-text)]/70 hover:bg-[var(--workspace-shell-sidebar-accent)]',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(
          [
            ['askingRent', 'Asking rent from'],
            ['askingRentTo', 'Asking rent to (optional)'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label
              htmlFor={`listing-${key}`}
              className="text-[var(--workspace-shell-text)]/70"
            >
              {label}
            </Label>
            <InputGroup className={inputClassName}>
              <InputGroupAddon>
                <InputGroupText>£</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id={`listing-${key}`}
                type="number"
                min={0}
                step={0.01}
                value={values[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{unit}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]/70">
        <input
          type="checkbox"
          checked={values.hideRentFromMarketing}
          onChange={(e) =>
            onChange({ hideRentFromMarketing: e.target.checked })
          }
          className="rounded border-[color:var(--workspace-shell-border)]"
        />
        Hide rent from marketing (POA)
      </label>

      {quoted || warnings.length > 0 ? (
        <div className="space-y-1.5 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2.5 text-xs">
          {quoted ? (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
              <dt className="text-[var(--workspace-shell-text-muted)]">
                Quoted as
              </dt>
              <dd className="text-[var(--workspace-shell-text)]">{quoted}</dd>
              {basis !== 'per_annum' && annual ? (
                <>
                  <dt className="text-[var(--workspace-shell-text-muted)]">
                    Works out at
                  </dt>
                  <dd className="text-[var(--workspace-shell-text)]">
                    {formatAnnualRent(annual)}
                    {basis === 'per_sqft' ? (
                      <span className="text-[var(--workspace-shell-text-muted)]">
                        {' '}
                        (rate × size)
                      </span>
                    ) : null}
                  </dd>
                </>
              ) : null}
              {showRightmove ? (
                <>
                  <dt className="text-[var(--workspace-shell-text-muted)]">
                    On Rightmove
                  </dt>
                  <dd className="font-medium text-[var(--workspace-shell-text)]">
                    {rightmove}
                  </dd>
                </>
              ) : null}
            </dl>
          ) : null}
          {warnings.map((warning) => (
            <p
              key={warning}
              className="flex gap-1.5 text-[var(--workspace-shell-accent-text)]"
            >
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {RENT_WARNING_TEXT[warning]}
            </p>
          ))}
          {showRightmove && basis === 'per_sqft' && quoted ? (
            <p className="text-[var(--workspace-shell-text-muted)]">
              Rightmove only takes a yearly or monthly total, so it gets the
              rate × size. Rightmove&apos;s price search uses that figure, even
              when the rent shows as POA.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
