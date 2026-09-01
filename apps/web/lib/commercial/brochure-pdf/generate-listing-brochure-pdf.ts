import 'server-only';

import type {
  BrochureDisplayOptions,
  BrochureDocument,
  BrochureOrientation,
  BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { buildBrochureDocument } from '~/lib/commercial/brochure-pdf/build-brochure-document';
import { loadListingBrochureData } from '~/lib/commercial/brochure-pdf/load-listing-brochure-data';
import { renderBrochurePdf } from '~/lib/commercial/brochure-pdf/render-brochure-pdf';

export async function generateListingBrochurePdf(input: {
  listingId: string;
  accountId: string;
  orientation: BrochureOrientation;
  templateId: BrochureTemplateId;
  document?: BrochureDocument | null;
  display?: Partial<BrochureDisplayOptions>;
}): Promise<{
  bytes: Uint8Array;
  document: BrochureDocument;
  filename: string;
}> {
  const data = await loadListingBrochureData(input.listingId, input.accountId);
  if (!data) {
    throw new Error('Listing not found');
  }

  if (input.display?.showReducedPrice != null) {
    data.showReducedPrice = input.display.showReducedPrice;
  }

  const document =
    input.document ??
    buildBrochureDocument(data, {
      orientation: input.orientation,
      templateId: input.templateId,
      display: input.display,
    });

  const bytes = await renderBrochurePdf(document, data);
  const slug = (data.listing.name || 'brochure')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const filename = `${slug || 'brochure'}-${input.orientation}-${input.templateId}.pdf`;

  return { bytes, document, filename };
}
