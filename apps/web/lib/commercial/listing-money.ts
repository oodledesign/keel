/** Display helpers for disposal list/map money. */
import {
  formatRent,
  formatRentAmount,
  rentBasis,
  rentBasisShortUnit,
} from './listing-rent';

export function rentFrequencySuffix(
  frequency: string | null | undefined,
): 'pa' | 'pcm' | 'psf' {
  return rentBasisShortUnit(rentBasis(frequency));
}

/** Asking rent amount only (range when from ≠ to). Null if neither bound is set. */
export function formatListingRentAmount(
  fromPence: number | null | undefined,
  toPence: number | null | undefined,
  frequency?: string | null,
): string | null {
  return formatRentAmount(fromPence, toPence, rentBasis(frequency));
}

export function formatListingRent(
  fromPence: number | null | undefined,
  toPence: number | null | undefined,
  frequency: string | null | undefined,
): string | null {
  return formatRent(fromPence, toPence, rentBasis(frequency), 'short');
}
