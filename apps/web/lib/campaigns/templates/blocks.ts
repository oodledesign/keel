import {
  CAMPAIGN_DOCUMENT_VERSION,
  type CampaignAlign,
  type CampaignBlock,
  type CampaignBrand,
  type CampaignColumnContent,
  type CampaignDocument,
  createCampaignBlockId,
  isSafeHttpUrl,
} from '../campaign-document';

export function headingBlock(
  text: string,
  level: 1 | 2 = 1,
  align: CampaignAlign = 'left',
): CampaignBlock {
  return { id: createCampaignBlockId(), type: 'heading', text, level, align };
}

export function textBlock(
  html: string,
  align: CampaignAlign = 'left',
): CampaignBlock {
  return { id: createCampaignBlockId(), type: 'text', html, align };
}

export function paragraphs(...lines: string[]): string {
  return lines.map((line) => `<p>${line}</p>`).join('');
}

export function buttonBlock(
  label: string,
  href = '',
  align: CampaignAlign = 'center',
): CampaignBlock {
  return { id: createCampaignBlockId(), type: 'button', label, href, align };
}

export function imageBlock(alt: string): CampaignBlock {
  return { id: createCampaignBlockId(), type: 'image', src: '', alt };
}

export function logoBlock(align: CampaignAlign = 'left'): CampaignBlock {
  return { id: createCampaignBlockId(), type: 'logo', align };
}

export function dividerBlock(): CampaignBlock {
  return { id: createCampaignBlockId(), type: 'divider' };
}

export function spacerBlock(height = 24): CampaignBlock {
  return { id: createCampaignBlockId(), type: 'spacer', height };
}

export function columnsBlock(
  left: CampaignColumnContent,
  right: CampaignColumnContent,
): CampaignBlock {
  return { id: createCampaignBlockId(), type: 'columns', left, right };
}

export function footerBlock(text?: string): CampaignBlock {
  return {
    id: createCampaignBlockId(),
    type: 'footer',
    text:
      text ??
      'You are receiving this because you subscribed to updates from this workspace.',
  };
}

export function brandHref(brand: CampaignBrand, fallback = ''): string {
  const website = brand.website_url?.trim();
  return website && isSafeHttpUrl(website) ? website : fallback;
}

export function campaignDocument(...blocks: CampaignBlock[]): CampaignDocument {
  const withFooter = blocks.some((block) => block.type === 'footer')
    ? blocks
    : [...blocks, footerBlock()];

  return {
    version: CAMPAIGN_DOCUMENT_VERSION,
    blocks: withFooter,
  };
}
