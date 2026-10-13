import type { BrochureFooterSettings } from '~/lib/commercial/brochure-pdf/brochure-document';
import type { BrochureBranch } from '~/lib/commercial/public-brochure.shared';

export const DEFAULT_BROCHURE_NOTICE = 'Subject to contract';

export type ResolvedBrochureFooter = {
  office: string | null;
  notice: string | null;
  pageNumbers: boolean;
};

/** "Bracketts · 27/29 High Street, Tunbridge Wells · 01892 526111" */
export function brochureOfficeLine(
  accountName: string | null | undefined,
  branch: Pick<BrochureBranch, 'address' | 'phone'> | null | undefined,
): string {
  return [
    accountName?.trim(),
    branch?.address?.replace(/\s*\n\s*/g, ', ').trim(),
    branch?.phone?.trim(),
  ]
    .filter(Boolean)
    .join('  ·  ');
}

/** What the footer shows; blank custom text falls back to the automatic text. */
export function resolveBrochureFooter(
  settings: BrochureFooterSettings | undefined,
  automaticOffice: string,
): ResolvedBrochureFooter {
  const office = settings?.officeText?.trim() || automaticOffice;
  const notice = settings?.noticeText?.trim() || DEFAULT_BROCHURE_NOTICE;
  return {
    office: settings?.showOffice === false ? null : office || null,
    notice: settings?.showNotice === false ? null : notice,
    pageNumbers: settings?.showPageNumbers !== false,
  };
}
