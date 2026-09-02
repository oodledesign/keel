import { describe, expect, it } from 'vitest';

import {
  type SignaturesStaffRow,
  TRANSPARENT_PIXEL_GIF,
  renderTemplate,
  resolveCompanyLogoUrl,
  resolvePhotoAndBadgeUrls,
  stripTransparentBadgeImages,
} from './render-template';
import {
  createSignatureBlock,
  signatureBlocksToHtml,
} from './signature-blocks';

const staffBase: SignaturesStaffRow = {
  id: 'staff-1',
  account_id: 'account-1',
  email: 'ada@example.com',
  full_name: 'Ada Lovelace',
  job_title: 'Engineer',
  department: null,
  phone_direct: null,
  phone_mobile: null,
  branch: null,
  photo_url: null,
};

const brand = {
  account_id: 'account-1',
  logo_url: 'https://cdn.example.com/brand-logo.png',
  primary_color: '#0D2344',
  secondary_color: '#FFFFFF',
  accent_color: '#e63329',
  website_url: 'https://example.com',
  address: '1 Main St',
  contact_email: null,
  phone: null,
};

describe('resolveCompanyLogoUrl', () => {
  it('prefers the company logo over brand', () => {
    expect(
      resolveCompanyLogoUrl('https://cdn.example.com/company.png', brand),
    ).toBe('https://cdn.example.com/company.png');
  });

  it('falls back to brand logo', () => {
    expect(resolveCompanyLogoUrl(null, brand)).toBe(brand.logo_url);
  });

  it('falls back to transparent pixel when neither is set', () => {
    expect(resolveCompanyLogoUrl(null, { ...brand, logo_url: null })).toBe(
      TRANSPARENT_PIXEL_GIF,
    );
  });
});

describe('resolvePhotoAndBadgeUrls', () => {
  it('badges the company icon when a staff photo exists', () => {
    expect(
      resolvePhotoAndBadgeUrls({
        staffPhotoUrl: 'https://cdn.example.com/photo.jpg',
        companyIconUrl: 'https://cdn.example.com/icon.png',
      }),
    ).toEqual({
      photoUrl: 'https://cdn.example.com/photo.jpg',
      badgeUrl: 'https://cdn.example.com/icon.png',
    });
  });

  it('fills the photo slot with the icon when there is no staff photo', () => {
    expect(
      resolvePhotoAndBadgeUrls({
        staffPhotoUrl: null,
        companyIconUrl: 'https://cdn.example.com/icon.png',
      }),
    ).toEqual({
      photoUrl: 'https://cdn.example.com/icon.png',
      badgeUrl: TRANSPARENT_PIXEL_GIF,
    });
  });

  it('ignores company icon when showPhotoBadge is false', () => {
    expect(
      resolvePhotoAndBadgeUrls({
        staffPhotoUrl: 'https://cdn.example.com/photo.jpg',
        companyIconUrl: 'https://cdn.example.com/icon.png',
        showPhotoBadge: false,
      }),
    ).toEqual({
      photoUrl: 'https://cdn.example.com/photo.jpg',
      badgeUrl: TRANSPARENT_PIXEL_GIF,
    });
  });

  it('uses transparent placeholders when neither photo nor icon exist', () => {
    expect(
      resolvePhotoAndBadgeUrls({
        staffPhotoUrl: null,
        companyIconUrl: null,
      }),
    ).toEqual({
      photoUrl: TRANSPARENT_PIXEL_GIF,
      badgeUrl: TRANSPARENT_PIXEL_GIF,
    });
  });
});

describe('renderTemplate company assets', () => {
  it('resolves company_logo_url with brand fallback and photo badge tokens', () => {
    const html = renderTemplate(
      [
        '<img src="{{company_logo_url}}" />',
        '<img src="{{brand_logo_url}}" />',
        '<img src="{{photo_url}}" />',
        '<img src="{{company_icon_badge_url}}" />',
      ].join(''),
      { ...staffBase, photo_url: 'https://cdn.example.com/photo.jpg' },
      {
        brand,
        companyLogoUrl: 'https://cdn.example.com/company.png',
        companyIconUrl: 'https://cdn.example.com/icon.png',
      },
    );

    expect(html).toContain('https://cdn.example.com/company.png');
    expect(html).toContain('https://cdn.example.com/brand-logo.png');
    expect(html).toContain('https://cdn.example.com/photo.jpg');
    expect(html).toContain('https://cdn.example.com/icon.png');
  });

  it('substitutes the company icon into photo_url when staff has no photo', () => {
    const html = renderTemplate(
      '<img src="{{photo_url}}" /><img src="{{company_icon_badge_url}}" />',
      staffBase,
      {
        brand,
        companyIconUrl: 'https://cdn.example.com/icon.png',
      },
    );

    expect(html).toContain('src="https://cdn.example.com/icon.png"');
    expect(html).toContain(`src="${TRANSPARENT_PIXEL_GIF}"`);
  });

  it('uses brand logo for company_logo_url when company logo is unset', () => {
    const html = renderTemplate(
      '<img src="{{company_logo_url}}" />',
      staffBase,
      {
        brand,
        companyLogoUrl: null,
      },
    );

    expect(html).toContain(brand.logo_url);
  });

  it('strips empty contact blocks from builder HTML', () => {
    const template = signatureBlocksToHtml({
      version: 1,
      layout: 'stacked',
      showContactIcons: true,
      blocks: [
        createSignatureBlock('phone_direct'),
        createSignatureBlock('email'),
        createSignatureBlock('website'),
      ],
    });

    const html = renderTemplate(template, staffBase, {
      brand: { ...brand, website_url: 'https://example.com' },
    });

    expect(html).not.toContain('type="phone_direct"');
    expect(html).toContain('ada@example.com');
    expect(html).toContain('https://example.com');
  });

  it('uses Ozer profile overrides in merge tokens', () => {
    const html = renderTemplate(
      '{{full_name}} · {{job_title}} · {{department}}',
      {
        ...staffBase,
        full_name: 'Ada Lovelace',
        job_title: 'Engineer',
        department: 'Mathematics',
        full_name_override: 'Ada L.',
        job_title_override: 'Partner',
        department_override: 'Client Services',
      },
    );

    expect(html).toContain('Ada L.');
    expect(html).toContain('Partner');
    expect(html).toContain('Client Services');
    expect(html).not.toContain('Ada Lovelace');
    expect(html).not.toContain('Engineer');
    expect(html).not.toContain('Mathematics');
  });

  it('falls back to directory values when overrides are empty', () => {
    const html = renderTemplate(
      '{{full_name}} · {{job_title}} · {{department}}',
      {
        ...staffBase,
        full_name: 'Ada Lovelace',
        job_title: 'Engineer',
        department: 'Mathematics',
        full_name_override: '  ',
        job_title_override: null,
        department_override: null,
      },
    );

    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Engineer');
    expect(html).toContain('Mathematics');
  });

  it('strips transparent badge images', () => {
    const html = stripTransparentBadgeImages(
      `<img src="${TRANSPARENT_PIXEL_GIF}" alt="" width="24" height="24" />`,
    );
    expect(html).toBe('');
  });
});
