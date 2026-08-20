import { describe, expect, it } from 'vitest';

import {
  katoFileAlreadyExists,
  mapKatoEpcBand,
  mapKatoFileType,
  mapKatoFloorLabel,
  mapKatoMeasurementStandard,
  parseKatoFeedEpcBands,
  parseKatoFeedFiles,
  parseKatoFeedListingAttrs,
  parseKatoFeedUnits,
} from '../kato-feed-files';

describe('mapKatoFileType', () => {
  it('maps Kato file types to Ozer media types', () => {
    expect(mapKatoFileType('11')).toBe('brochure');
    expect(mapKatoFileType('15', 'Floor Plan')).toBe('floorplan');
    expect(mapKatoFileType('3')).toBe('epc');
    expect(mapKatoFileType(null, 'Energy performance certificate')).toBe('epc');
  });
});

describe('parseKatoFeedFiles', () => {
  it('extracts brochures, floorplans, and EPCs (not gallery images)', () => {
    const xml = `
      <properties>
        <property>
          <id>278736</id>
          <images><image name="hero.jpg">https://img.example/hero.jpg</image></images>
          <files>
            <file>
              <name>Unit 9 brochure.pdf</name>
              <description>Document</description>
              <url>https://files.example/brochure.pdf</url>
              <type>11</type>
            </file>
            <file>
              <name>Floorplan.jpg</name>
              <description>Floor Plan</description>
              <url>https://files.example/plan.jpg</url>
              <type>15</type>
            </file>
          </files>
          <epcs>
            <epc>
              <name>EPC.pdf</name>
              <description/>
              <url>https://files.example/epc.pdf</url>
            </epc>
          </epcs>
        </property>
      </properties>
    `;

    const items = parseKatoFeedFiles(xml);
    expect(items.map((i) => i.mediaType).sort()).toEqual([
      'brochure',
      'epc',
      'floorplan',
    ]);
    expect(items.some((i) => i.url.includes('hero.jpg'))).toBe(false);
    expect(items.find((i) => i.mediaType === 'brochure')?.fileName).toBe(
      'Unit 9 brochure.pdf',
    );
  });
});

describe('katoFileAlreadyExists', () => {
  it('matches existing rows by file name or external url', () => {
    const existing = [{ file_name: 'Unit 9 brochure.pdf', external_url: null }];
    expect(
      katoFileAlreadyExists(existing, {
        externalId: '1',
        mediaType: 'brochure',
        fileName: 'Unit 9 brochure.pdf',
        url: 'https://files.example/brochure.pdf',
        source: 'files',
        katoFileType: '11',
      }),
    ).toBe(true);
    expect(
      katoFileAlreadyExists(existing, {
        externalId: '1',
        mediaType: 'epc',
        fileName: 'EPC.pdf',
        url: 'https://files.example/epc.pdf',
        source: 'epc',
        katoFileType: null,
      }),
    ).toBe(false);
  });
});

describe('parseKatoFeedUnits', () => {
  it('maps floor codes, sizes, and rents', () => {
    const xml = `
      <properties>
        <property>
          <id>188515</id>
          <floor_units>
            <floor_unit>
              <meta_id>410675</meta_id>
              <floorunit>unit</floorunit>
              <description>3B</description>
              <size_sqft>480</size_sqft>
              <rent_price>4250</rent_price>
              <rent_sqft>£8.85</rent_sqft>
              <fitted_space>Not Fitted</fitted_space>
              <status>Available</status>
            </floor_unit>
          </floor_units>
        </property>
      </properties>
    `;
    const units = parseKatoFeedUnits(xml);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      listingExternalId: '188515',
      unitExternalId: '410675',
      label: 'Unit · 3B',
      floorOrUnit: 'Unit',
      sizeSqft: 480,
      askingRentPence: 425_000,
      rentPerSqft: 8.85,
      fittedSpace: false,
    });
    expect(mapKatoFloorLabel('g')).toBe('Ground');
  });
});

describe('parseKatoFeedEpcBands', () => {
  it('reads letter bands and ignores empty ratings', () => {
    const xml = `
      <properties>
        <property>
          <id>363472</id>
          <current_energy_ratings><rating value="59">C</rating></current_energy_ratings>
        </property>
        <property>
          <id>1</id>
          <current_energy_ratings></current_energy_ratings>
        </property>
      </properties>
    `;
    expect(parseKatoFeedEpcBands(xml)).toEqual([
      { listingExternalId: '363472', epcBand: 'C', epcRating: 59 },
    ]);
    expect(mapKatoEpcBand('b')).toBe('B');
    expect(mapKatoEpcBand('POA')).toBeNull();
  });
});

describe('parseKatoFeedListingAttrs', () => {
  it('maps ROA, NIA, land, insurance, tenancy, and street view', () => {
    const xml = `
      <properties>
        <property>
          <id>123</id>
          <object_id>123</object_id>
          <name>Plot 6</name>
          <fitted>f</fitted>
          <fitted_comment>Not Fitted</fitted_comment>
          <rent>On Application</rent>
          <rent_components><on_application>1</on_application></rent_components>
          <price></price>
          <price_components></price_components>
          <size_measure>Net Internal Area</size_measure>
          <rates_payable>4.26</rates_payable>
          <rateable_value_period>sqft</rateable_value_period>
          <marketing_title_1>Specifications</marketing_title_1>
          <marketing_text_1>Ground floor offices</marketing_text_1>
          <insurance_type>FRI (Full repairing insuring)</insurance_type>
          <tenancy_status>Vacant</tenancy_status>
          <land_size_from>0.19</land_size_from>
          <land_size_to>0.19</land_size_to>
          <land_size_metric>hectare</land_size_metric>
          <on_market_date>2025-02-03 13:10:24</on_market_date>
          <street_view_data>
            <pano>GccqfMmpoeMvRRKkXIsx6w</pano>
            <heading>66.02</heading>
            <pitch>-6.58</pitch>
            <zoom>1</zoom>
          </street_view_data>
        </property>
      </properties>
    `;
    const [row] = parseKatoFeedListingAttrs(xml);
    expect(row).toMatchObject({
      listingExternalId: '123',
      displayName: 'Plot 6',
      hideRentFromMarketing: true,
      hidePriceFromMarketing: false,
      ratesPayablePerSqft: 4.26,
      measurementStandard: 'nia',
      specificationsTitle: 'Specifications',
      insuranceType: 'FRI (Full repairing insuring)',
      tenancyStatus: 'Vacant',
      landSizeMin: 0.19,
      landSizeMetric: 'hectare',
      streetViewPanoId: 'GccqfMmpoeMvRRKkXIsx6w',
      fittedSpace: false,
    });
    expect(row?.onMarketAt).toMatch(/^2025-02-03T/);
    expect(mapKatoMeasurementStandard('Gross Internal Area')).toBe('gia');
  });
});
