import { type CampaignDocument, stripHtmlToText } from './campaign-document';

/**
 * Lightweight signals for the hub thumbnail.
 * Uses structured `body_document` already on the list row — never html_body.
 */
export type CampaignListPreviewHints = {
  heading: string;
  hasLogo: boolean;
  hasImage: boolean;
  hasButton: boolean;
  hasColumns: boolean;
  hasText: boolean;
};

export function campaignListPreviewHints(
  document: CampaignDocument | null,
  subject: string,
): CampaignListPreviewHints {
  const blocks = document?.blocks ?? [];
  const headingBlock = blocks.find(
    (block) => block.type === 'heading' && block.text.trim().length > 0,
  );
  const heading =
    (headingBlock && headingBlock.type === 'heading'
      ? headingBlock.text.trim()
      : '') ||
    subject.trim() ||
    'Untitled';

  return {
    heading,
    hasLogo: blocks.some((block) => block.type === 'logo'),
    hasImage: blocks.some((block) => {
      if (block.type === 'image') return Boolean(block.src.trim());
      if (block.type === 'columns') {
        return (
          (block.left.kind === 'image' && Boolean(block.left.src.trim())) ||
          (block.right.kind === 'image' && Boolean(block.right.src.trim()))
        );
      }
      return false;
    }),
    hasButton: blocks.some(
      (block) => block.type === 'button' && block.label.trim().length > 0,
    ),
    hasColumns: blocks.some((block) => block.type === 'columns'),
    hasText: blocks.some(
      (block) =>
        block.type === 'text' && stripHtmlToText(block.html).length > 0,
    ),
  };
}
