import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  BrochureDisplayOptions,
  BrochureDocument,
  BrochureOrientation,
  BrochureRenderWarning,
  BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { buildBrochureDocument } from '~/lib/commercial/brochure-pdf/build-brochure-document';
import { hydrateBrochureDocument } from '~/lib/commercial/brochure-pdf/hydrate-brochure-document';
import { loadListingBrochureData } from '~/lib/commercial/brochure-pdf/load-listing-brochure-data';
import { renderBrochurePdf } from '~/lib/commercial/brochure-pdf/render-brochure-pdf';

export async function generateListingBrochurePdf(input: {
  listingId: string;
  accountId: string;
  orientation: BrochureOrientation;
  templateId: BrochureTemplateId;
  document?: BrochureDocument | null;
  display?: Partial<BrochureDisplayOptions>;
  /** Override the RLS client. Public feed downloads pass the admin client. */
  client?: SupabaseClient;
}): Promise<{
  bytes: Uint8Array;
  /** The layout as rendered: media refreshed, empty photo pages dropped. */
  document: BrochureDocument;
  filename: string;
  /** Saved page numbers refer to `input.document` (or the built layout). */
  warnings: BrochureRenderWarning[];
}> {
  const data = await loadListingBrochureData(
    input.listingId,
    input.accountId,
    input.client,
  );
  if (!data) {
    throw new Error('Listing not found');
  }

  if (input.display?.showReducedPrice != null) {
    data.showReducedPrice = input.display.showReducedPrice;
  }
  if (input.display?.showWebsiteListingButton != null) {
    data.showWebsiteListingButton = input.display.showWebsiteListingButton;
  }
  if (input.display?.showSlideshowBrochureButton != null) {
    data.showSlideshowBrochureButton =
      input.display.showSlideshowBrochureButton;
  }

  const built =
    input.document ??
    buildBrochureDocument(data, {
      orientation: input.orientation,
      templateId: input.templateId,
      display: input.display,
    });

  // Saved layouts often have null image slots / expired signed URLs.
  // Always refill from current listing media before painting.
  const document = hydrateBrochureDocument(built, data);

  const rendererWarnings: BrochureRenderWarning[] = [];
  const bytes = await renderBrochurePdf(document, data, {
    warnings: rendererWarnings,
  });
  const savedNumber = new Map(
    built.pages.map((page, index) => [page.id, index + 1]),
  );
  const warnings = rendererWarnings.map((warning) => ({
    ...warning,
    pageNumber: savedNumber.get(warning.pageId) ?? warning.pageNumber,
  }));
  const rendered = new Set(document.pages.map((page) => page.id));
  built.pages.forEach((page, index) => {
    if (!rendered.has(page.id)) {
      warnings.push({
        pageId: page.id,
        pageNumber: index + 1,
        kind: 'empty_page',
      });
    }
  });
  const slug = (data.listing.name || 'brochure')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const filename = `${slug || 'brochure'}-${input.orientation}-${input.templateId}.pdf`;

  return { bytes, document, filename, warnings };
}
