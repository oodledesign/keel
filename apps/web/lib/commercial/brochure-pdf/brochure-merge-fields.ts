import {
  type BrochureDisplayOptions,
  type BrochureDocument,
  type BrochurePage,
  type BrochureSlotValue,
  DEFAULT_BROCHURE_DISPLAY_OPTIONS,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import {
  brochurePriceValue,
  brochureRentValue,
  brochureSizeValue,
  formatEpc,
  formatPerSqft,
  formatTenure,
} from '~/lib/commercial/brochure-pdf/build-brochure-document';
import {
  type BrochureListing,
  formatBrochureAddress,
  formatDisposalLabel,
} from '~/lib/commercial/public-brochure.shared';

type MergeField = {
  label: string;
  value: (listing: BrochureListing, display: BrochureDisplayOptions) => string;
};

/** Listing details that can be written into brochure text as `{Label}`, filled in when the PDF is drawn. */
export const BROCHURE_MERGE_FIELDS: MergeField[] = [
  { label: 'Disposal', value: (l) => formatDisposalLabel(l.disposalType) },
  { label: 'Rent', value: (l, d) => brochureRentValue(l, d) ?? '' },
  { label: 'Price', value: (l, d) => brochurePriceValue(l, d) ?? '' },
  { label: 'Size', value: (l) => brochureSizeValue(l) ?? '' },
  { label: 'Tenure', value: (l) => formatTenure(l) ?? '' },
  { label: 'Use class', value: (l) => l.useClass?.trim() ?? '' },
  {
    label: 'Business rates',
    value: (l) => formatPerSqft(l.ratesPayablePerSqft) ?? '',
  },
  {
    label: 'Service charge',
    value: (l) => formatPerSqft(l.serviceChargePerSqft) ?? '',
  },
  {
    label: 'Estate charge',
    value: (l) => formatPerSqft(l.estateChargePerSqft) ?? '',
  },
  { label: 'EPC', value: (l) => formatEpc(l) ?? '' },
  { label: 'Available from', value: (l) => l.availableFrom?.trim() ?? '' },
  { label: 'Property name', value: (l) => l.name.trim() },
  { label: 'Address', value: (l) => formatBrochureAddress(l) },
  { label: 'Town', value: (l) => l.town?.trim() ?? '' },
  { label: 'Postcode', value: (l) => l.postcode?.trim() ?? '' },
];

export function brochureMergeFieldToken(label: string): string {
  return `{${label}}`;
}

const TOKEN = /\{([^{}\n]{1,40})\}/g;

function normalise(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

const FIELD_BY_NAME = new Map(
  BROCHURE_MERGE_FIELDS.map((field) => [normalise(field.label), field]),
);

/** Rent and price follow the listing's own "hide from marketing" settings unless the wizard says otherwise. */
export function brochureMergeFieldDisplay(
  listing: BrochureListing,
  display?: Partial<BrochureDisplayOptions>,
): BrochureDisplayOptions {
  const out: BrochureDisplayOptions = {
    ...DEFAULT_BROCHURE_DISPLAY_OPTIONS,
    showRent: !listing.hideRentFromMarketing,
    showPrice: !listing.hidePriceFromMarketing,
  };
  for (const [key, value] of Object.entries(display ?? {})) {
    if (typeof value === 'boolean') {
      out[key as keyof BrochureDisplayOptions] = value;
    }
  }
  return out;
}

/** Replace `{Field}` with the listing's value. Unknown names are left as typed. */
export function fillBrochureMergeFields(
  text: string,
  listing: BrochureListing,
  display: BrochureDisplayOptions,
): string {
  if (!text.includes('{')) return text;
  return text.replace(TOKEN, (token, name: string) => {
    const field = FIELD_BY_NAME.get(normalise(name));
    return field ? field.value(listing, display) : token;
  });
}

function fillSlot(
  slot: BrochureSlotValue,
  fill: (text: string) => string,
): BrochureSlotValue {
  if (slot.type === 'text') {
    const text = fill(slot.text);
    return text === slot.text ? slot : { ...slot, text };
  }
  if (slot.type === 'facts') {
    let changed = false;
    const rows = slot.rows.map((row) => {
      const label = fill(row.label);
      const value = fill(row.value);
      if (label === row.label && value === row.value) return row;
      changed = true;
      return { label, value };
    });
    return changed ? { ...slot, rows } : slot;
  }
  return slot;
}

/** The document with merge fields in page text and facts filled from the listing. */
export function resolveBrochureMergeFields(
  document: BrochureDocument,
  listing: BrochureListing,
  display?: Partial<BrochureDisplayOptions>,
): BrochureDocument {
  const resolved = brochureMergeFieldDisplay(listing, display);
  const fill = (text: string) =>
    fillBrochureMergeFields(text, listing, resolved);
  let changed = false;
  const pages = document.pages.map((page): BrochurePage => {
    let slots = page.slots;
    for (const [key, slot] of Object.entries(page.slots)) {
      const next = fillSlot(slot, fill);
      if (next === slot) continue;
      if (slots === page.slots) slots = { ...page.slots };
      slots[key] = next;
    }
    if (slots === page.slots) return page;
    changed = true;
    return { ...page, slots };
  });
  return changed ? { ...document, pages } : document;
}
