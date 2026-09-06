export type CampaignQuotaKind = 'sends' | 'contacts';

export class CampaignQuotaError extends Error {
  readonly kind: CampaignQuotaKind;
  readonly needed: number;
  readonly have: number;

  constructor(input: {
    kind: CampaignQuotaKind;
    message: string;
    needed: number;
    have: number;
  }) {
    super(input.message);
    this.name = 'CampaignQuotaError';
    this.kind = input.kind;
    this.needed = input.needed;
    this.have = input.have;
  }
}

export function isCampaignQuotaError(
  error: unknown,
): error is CampaignQuotaError {
  return error instanceof CampaignQuotaError;
}
