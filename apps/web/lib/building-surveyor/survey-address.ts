import type { AddressSuggestion } from '~/lib/commercial/address-suggest.types';

/**
 * Build a surveyor-facing address line from Mapbox (or any) suggestion.
 * UPRN is not returned by Mapbox Geocoding — it is filled later from the
 * EPC register when a certificate matches.
 */
export function formatSurveyAddress(
  suggestion: Pick<
    AddressSuggestion,
    'addressLine1' | 'addressLine2' | 'town' | 'county' | 'postcode' | 'label'
  >,
): string {
  const parts = [
    suggestion.addressLine1,
    suggestion.addressLine2,
    suggestion.town,
    suggestion.county &&
    suggestion.county.toLowerCase() !== suggestion.town?.toLowerCase()
      ? suggestion.county
      : null,
    suggestion.postcode,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);

  if (parts.length > 0) return parts.join(', ');
  return suggestion.label.replace(/,\s*United Kingdom$/i, '').trim();
}

export function suggestionToSurveyLookup(suggestion: AddressSuggestion): {
  address: string;
  postcode: string | null;
  latitude: number;
  longitude: number;
  uprn: string | null;
} {
  return {
    address: formatSurveyAddress(suggestion),
    postcode: suggestion.postcode?.trim() || null,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    uprn: null,
  };
}
