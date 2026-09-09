import { describe, expect, it } from 'vitest';

import {
  defaultCampaignBlockPadding,
  detectCampaignPaddingPreset,
  resolveCampaignBlockBackground,
  resolveCampaignBlockPadding,
  resolveCampaignImageLayout,
} from './campaign-block-style';
import {
  createCampaignBlock,
  parseCampaignDocument,
} from './campaign-document';

const brand = {
  primary_color: '#0D2344',
  secondary_color: '#FFFFFF',
  accent_color: '#57C87F',
  logo_url: 'https://cdn.example.com/logo.png',
};

describe('campaign block style', () => {
  it('keeps existing logo and content padding defaults', () => {
    expect(defaultCampaignBlockPadding('logo')).toEqual({
      top: 20,
      right: 28,
      bottom: 20,
      left: 28,
    });
    expect(defaultCampaignBlockPadding('text')).toEqual({
      top: 12,
      right: 28,
      bottom: 12,
      left: 28,
    });
    expect(defaultCampaignBlockPadding('image', 'full')).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it('uses brand primary on logos unless background is cleared', () => {
    const logo = createCampaignBlock('logo');
    expect(resolveCampaignBlockBackground(logo, brand)).toBe('#0D2344');
    expect(
      resolveCampaignBlockBackground(
        { ...logo, backgroundColor: 'transparent' },
        brand,
      ),
    ).toBeNull();
    expect(
      resolveCampaignBlockBackground(
        { ...logo, backgroundColor: '#FF5C34' },
        brand,
      ),
    ).toBe('#FF5C34');
  });

  it('detects padding presets and custom sides', () => {
    const heading = createCampaignBlock('heading');
    expect(detectCampaignPaddingPreset(undefined, 'heading')).toBe('default');
    expect(
      detectCampaignPaddingPreset(
        { top: 0, right: 0, bottom: 0, left: 0 },
        'heading',
      ),
    ).toBe('none');
    expect(
      detectCampaignPaddingPreset(
        { top: 10, right: 4, bottom: 10, left: 4 },
        'heading',
      ),
    ).toBe('custom');
    expect(resolveCampaignBlockPadding(heading)).toEqual(
      defaultCampaignBlockPadding('heading'),
    );
  });

  it('maps image size presets to email-safe widths', () => {
    const image = createCampaignBlock('image');
    if (image.type !== 'image') throw new Error('expected image');

    expect(resolveCampaignImageLayout(image).width).toBe(544);
    expect(
      resolveCampaignImageLayout({ ...image, size: 'full' }),
    ).toMatchObject({ width: 600, fullWidth: true });
    expect(resolveCampaignImageLayout({ ...image, size: 'small' }).width).toBe(
      240,
    );
    expect(
      resolveCampaignImageLayout({
        ...image,
        size: 'custom',
        width: 180,
        height: 90,
      }),
    ).toMatchObject({ width: 180, height: 90 });
  });

  it('parses new inspector fields and drops invalid colours', () => {
    const parsed = parseCampaignDocument({
      version: 1,
      blocks: [
        {
          id: 'l1',
          type: 'logo',
          logoVariant: 'on_dark',
          backgroundColor: 'red',
        },
        {
          id: 'h1',
          type: 'heading',
          text: 'Hi',
          level: 1,
          backgroundColor: '#FFF4E8',
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
        },
      ],
    });

    expect(parsed?.blocks[0]).toMatchObject({
      type: 'logo',
      logoVariant: 'on_dark',
    });
    expect(
      (parsed?.blocks[0] as { backgroundColor?: string }).backgroundColor,
    ).toBeUndefined();
    expect(parsed?.blocks[1]).toMatchObject({
      backgroundColor: '#FFF4E8',
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
    });
  });
});
