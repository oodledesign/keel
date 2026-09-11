import {
  ASKING_PRICE_QUALIFIER_PREFIXES,
  type AskingPriceQualifier,
  isAskingPriceQualifier,
  normalizeAskingPriceQualifier,
} from '~/lib/commercial/commercial-constants';

export type AskingPriceInput = {
  askingPricePence?: number | null;
  askingPriceQualifier?: AskingPriceQualifier | string | null;
  hidePriceFromMarketing?: boolean | null;
};

export function formatAskingPriceGbp(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

export function askingPriceQualifierPrefix(
  qualifier: string | null | undefined,
): string | null {
  return ASKING_PRICE_QUALIFIER_PREFIXES[
    normalizeAskingPriceQualifier(qualifier)
  ];
}

/**
 * Portal-canonical sale price string.
 * POA (`hidePriceFromMarketing`) wins over qualifier and amount.
 */
export function formatAskingPrice(input: AskingPriceInput): string | null {
  if (input.hidePriceFromMarketing) return 'POA';
  if (input.askingPricePence == null) return null;

  const amount = formatAskingPriceGbp(input.askingPricePence);
  const prefix = askingPriceQualifierPrefix(input.askingPriceQualifier);
  return prefix ? `${prefix} ${amount}` : amount;
}

export type PropertyHiveAskingPrice = {
  /** `<price>` text — prefixed amount or POA. Empty when sale price is not published. */
  price: string;
  /** Portal-canonical prefix for `<price_components><qualifier>`, else empty. */
  qualifier: string;
  /** Numeric pounds for `<value>`. */
  valuePounds: number | null;
  onApplication: boolean;
  /** Whether `<price>` / `<price_components>` should carry sale content. */
  hasSalePriceBlock: boolean;
};

export function buildPropertyHiveAskingPrice(input: {
  includesForSale: boolean;
  askingPricePence: number | null;
  askingPriceQualifier?: string | null;
  hidePriceFromMarketing: boolean;
}): PropertyHiveAskingPrice {
  if (!input.includesForSale) {
    return {
      price: '',
      qualifier: '',
      valuePounds: null,
      onApplication: false,
      hasSalePriceBlock: false,
    };
  }

  if (input.hidePriceFromMarketing) {
    return {
      price: 'POA',
      qualifier: '',
      valuePounds: null,
      onApplication: true,
      hasSalePriceBlock: true,
    };
  }

  if (input.askingPricePence == null) {
    return {
      price: '',
      qualifier: '',
      valuePounds: null,
      onApplication: false,
      hasSalePriceBlock: false,
    };
  }

  const valuePounds = Math.round(input.askingPricePence) / 100;
  const qualifier =
    askingPriceQualifierPrefix(input.askingPriceQualifier) ?? '';

  return {
    price:
      formatAskingPrice({
        askingPricePence: input.askingPricePence,
        askingPriceQualifier: input.askingPriceQualifier,
        hidePriceFromMarketing: false,
      }) ?? '',
    qualifier,
    valuePounds,
    onApplication: false,
    hasSalePriceBlock: true,
  };
}

export type RightmoveSaleDisplayQualifier =
  | 'NONE'
  | 'PRICE_ON_APPLICATION'
  | 'GUIDE_PRICE'
  | 'OFFERS_IN_EXCESS_OF'
  | 'OFFERS_IN_REGION_OF';

/**
 * Rightmove ADF `displayQualifier` when sales pricing is actually sent.
 * `none` returns undefined so the mapper can omit the field.
 */
export function rightmoveSaleDisplayQualifier(input: {
  hidePriceFromMarketing?: boolean | null;
  askingPriceQualifier?: string | null;
}): RightmoveSaleDisplayQualifier | undefined {
  if (input.hidePriceFromMarketing) return 'PRICE_ON_APPLICATION';

  switch (normalizeAskingPriceQualifier(input.askingPriceQualifier)) {
    case 'offers_in_excess_of':
      return 'OFFERS_IN_EXCESS_OF';
    case 'offers_in_region_of':
      return 'OFFERS_IN_REGION_OF';
    case 'guide_price':
      return 'GUIDE_PRICE';
    case 'none':
    default:
      return undefined;
  }
}

/** Best-effort qualifier from CSV / pasted sale-price text. */
export function parseAskingPriceQualifier(
  raw: string | null | undefined,
): AskingPriceQualifier {
  if (!raw?.trim()) return 'none';
  const trimmed = raw.trim();
  if (isAskingPriceQualifier(trimmed)) return trimmed;

  const s = trimmed.toLowerCase().replace(/[,]/g, ' ');

  if (
    /\boieo\b/.test(s) ||
    /offers?\s+in\s+excess/.test(s) ||
    /in\s+excess\s+of/.test(s) ||
    /offers?\s+over/.test(s)
  ) {
    return 'offers_in_excess_of';
  }

  if (
    /\boiro\b/.test(s) ||
    /offers?\s+in\s+region/.test(s) ||
    /in\s+region\s+of/.test(s)
  ) {
    return 'offers_in_region_of';
  }

  if (/guide\s+price/.test(s) || /\bguiding\b/.test(s)) {
    return 'guide_price';
  }

  return 'none';
}

export function parseAskingPriceField(raw: string | null | undefined): {
  pence: number | null;
  qualifier: AskingPriceQualifier;
} {
  if (!raw?.trim()) {
    return { pence: null, qualifier: 'none' };
  }

  const normalized = raw.replace(/,/g, '');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  const pounds = match ? Number(match[0]) : NaN;
  const pence = Number.isFinite(pounds) ? Math.round(pounds * 100) : null;

  return {
    pence,
    qualifier: parseAskingPriceQualifier(raw),
  };
}
