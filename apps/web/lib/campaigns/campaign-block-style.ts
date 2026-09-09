import {
  type CampaignBlock,
  type CampaignBlockType,
  type CampaignBrand,
  type CampaignImageSize,
  type CampaignPadding,
} from './campaign-document';

export const CAMPAIGN_CONTENT_WIDTH = 600;
export const CAMPAIGN_DEFAULT_IMAGE_WIDTH = 544;

export const CAMPAIGN_IMAGE_SIZE_WIDTHS: Record<
  Exclude<CampaignImageSize, 'custom'>,
  number
> = {
  full: CAMPAIGN_CONTENT_WIDTH,
  large: 480,
  medium: 360,
  small: 240,
};

export const CAMPAIGN_PADDING_PRESETS = {
  none: { top: 0, right: 0, bottom: 0, left: 0 },
  tight: { top: 8, right: 16, bottom: 8, left: 16 },
  comfortable: { top: 24, right: 32, bottom: 24, left: 32 },
} as const satisfies Record<string, CampaignPadding>;

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?$/;

export function isCampaignHexColor(
  value: string | null | undefined,
): value is string {
  return Boolean(value && HEX_COLOR_RE.test(value));
}

export function campaignPadding(
  top: number,
  right = top,
  bottom = top,
  left = right,
): CampaignPadding {
  return { top, right, bottom, left };
}

export function defaultCampaignBlockPadding(
  type: CampaignBlockType,
  imageSize?: CampaignImageSize,
): CampaignPadding {
  if (type === 'spacer') {
    return campaignPadding(0);
  }

  if (type === 'logo') {
    return campaignPadding(20, 28);
  }

  if (type === 'image' && imageSize === 'full') {
    return campaignPadding(0);
  }

  return campaignPadding(12, 28);
}

export function resolveCampaignBlockPadding(
  block: CampaignBlock,
): CampaignPadding {
  if (block.padding) {
    return block.padding;
  }

  return defaultCampaignBlockPadding(
    block.type,
    block.type === 'image' ? block.size : undefined,
  );
}

export function paddingCss(padding: CampaignPadding): string {
  return `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`;
}

export function paddingsEqual(
  left: CampaignPadding,
  right: CampaignPadding,
): boolean {
  return (
    left.top === right.top &&
    left.right === right.right &&
    left.bottom === right.bottom &&
    left.left === right.left
  );
}

export type CampaignPaddingPreset =
  | 'default'
  | 'none'
  | 'tight'
  | 'comfortable'
  | 'custom';

export function detectCampaignPaddingPreset(
  padding: CampaignPadding | undefined,
  type: CampaignBlockType,
  imageSize?: CampaignImageSize,
): CampaignPaddingPreset {
  if (!padding) return 'default';
  if (paddingsEqual(padding, CAMPAIGN_PADDING_PRESETS.none)) return 'none';
  if (paddingsEqual(padding, CAMPAIGN_PADDING_PRESETS.tight)) return 'tight';
  if (paddingsEqual(padding, CAMPAIGN_PADDING_PRESETS.comfortable)) {
    return 'comfortable';
  }
  if (paddingsEqual(padding, defaultCampaignBlockPadding(type, imageSize))) {
    return 'default';
  }
  return 'custom';
}

/**
 * `undefined` keeps the type default (logo uses brand primary).
 * `transparent`, empty, or null means no background.
 */
export function resolveCampaignBlockBackground(
  block: CampaignBlock,
  brand?: CampaignBrand,
): string | null {
  const raw = block.backgroundColor;

  if (raw === 'transparent' || raw === '' || raw === null) {
    return null;
  }

  if (isCampaignHexColor(raw)) {
    return raw;
  }

  if (block.type === 'logo') {
    const primary = brand?.primary_color;
    return isCampaignHexColor(primary) ? primary : '#0D2344';
  }

  return null;
}

export function resolveCampaignImageLayout(
  block: Extract<CampaignBlock, { type: 'image' }>,
): {
  width: number;
  height?: number;
  fullWidth: boolean;
  size: CampaignImageSize | 'default';
} {
  const size = block.size;

  if (size === 'full') {
    return { width: CAMPAIGN_CONTENT_WIDTH, fullWidth: true, size };
  }

  if (size === 'custom') {
    return {
      width: clampInt(block.width ?? CAMPAIGN_DEFAULT_IMAGE_WIDTH, 40, 600),
      height: block.height ? clampInt(block.height, 20, 1200) : undefined,
      fullWidth: false,
      size,
    };
  }

  if (size === 'large' || size === 'medium' || size === 'small') {
    return {
      width: CAMPAIGN_IMAGE_SIZE_WIDTHS[size],
      fullWidth: false,
      size,
    };
  }

  return {
    width: CAMPAIGN_DEFAULT_IMAGE_WIDTH,
    fullWidth: false,
    size: 'default',
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
