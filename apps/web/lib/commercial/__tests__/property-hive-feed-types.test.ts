import { describe, expect, it } from 'vitest';

import { mapCommercialSectorToPropertyHiveTypes } from '../property-hive-feed-types';

describe('mapCommercialSectorToPropertyHiveTypes', () => {
  it('adds Industrial so Property Hive search term 45 can match', () => {
    expect(
      mapCommercialSectorToPropertyHiveTypes('Industrial / Warehouse'),
    ).toEqual(['Industrial / Warehouse', 'Industrial']);
  });

  it('maps Kato industrial labels the same way', () => {
    expect(
      mapCommercialSectorToPropertyHiveTypes('Industrial/Logistics'),
    ).toEqual(['Industrial/Logistics', 'Industrial']);
    expect(
      mapCommercialSectorToPropertyHiveTypes('Industrial / Logistics'),
    ).toEqual(['Industrial / Logistics', 'Industrial']);
  });

  it('keeps Offices and also offers the default singular Office term', () => {
    expect(mapCommercialSectorToPropertyHiveTypes('Offices')).toEqual([
      'Offices',
      'Office',
    ]);
  });

  it('points serviced offices at Offices and Office', () => {
    expect(mapCommercialSectorToPropertyHiveTypes('Serviced Office')).toEqual([
      'Serviced Office',
      'Offices',
      'Office',
    ]);
    expect(mapCommercialSectorToPropertyHiveTypes('Serviced Offices')).toEqual([
      'Serviced Offices',
      'Offices',
      'Office',
    ]);
  });

  it('leaves labels that already match Bracketts terms unchanged', () => {
    expect(mapCommercialSectorToPropertyHiveTypes('Retail / Leisure')).toEqual([
      'Retail / Leisure',
    ]);
    expect(mapCommercialSectorToPropertyHiveTypes('Land')).toEqual(['Land']);
    expect(mapCommercialSectorToPropertyHiveTypes('Development')).toEqual([
      'Development',
    ]);
    expect(mapCommercialSectorToPropertyHiveTypes('Investment')).toEqual([
      'Investment',
    ]);
  });

  it('returns no types when sector is blank', () => {
    expect(mapCommercialSectorToPropertyHiveTypes(null)).toEqual([]);
    expect(mapCommercialSectorToPropertyHiveTypes('   ')).toEqual([]);
  });
});
