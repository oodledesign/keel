/** Shared address autocomplete types (safe for client + server). */

export type AddressSuggestion = {
  id: string;
  label: string;
  /** Suggested disposal name (POI / street address). */
  nameHint: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  country: string;
  latitude: number;
  longitude: number;
};
