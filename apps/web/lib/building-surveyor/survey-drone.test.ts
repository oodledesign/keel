import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DRONE_FEE_PENCE,
  droneQuoteLine,
  droneReportText,
  formatDroneFee,
  inputFromPence,
  mapSurveyDrone,
  penceFromInput,
} from './survey-drone';

describe('formatDroneFee', () => {
  it('drops the pence for whole amounts', () => {
    expect(formatDroneFee(15_000)).toBe('£150');
    expect(formatDroneFee(15_050)).toBe('£150.50');
  });
});

describe('penceFromInput', () => {
  it('reads typed amounts', () => {
    expect(penceFromInput('150')).toBe(15_000);
    expect(penceFromInput('£150.50')).toBe(15_050);
    expect(penceFromInput('1,250')).toBe(125_000);
  });

  it('rejects anything that is not an amount', () => {
    expect(penceFromInput('')).toBeNull();
    expect(penceFromInput('abc')).toBeNull();
    expect(penceFromInput('-5')).toBeNull();
    expect(penceFromInput('1.234')).toBeNull();
    expect(penceFromInput('99999999')).toBeNull();
  });

  it('round-trips with inputFromPence', () => {
    expect(inputFromPence(15_000)).toBe('150');
    expect(penceFromInput(inputFromPence(15_050))).toBe(15_050);
  });
});

describe('droneQuoteLine', () => {
  it('has no line when no drone is used', () => {
    expect(
      droneQuoteLine({
        drone: { used: false, billing: 'separate', feePence: 20_000 },
        defaultFeePence: DEFAULT_DRONE_FEE_PENCE,
      }),
    ).toBeNull();
  });

  it('falls back to the workspace default fee', () => {
    expect(
      droneQuoteLine({
        drone: { used: true, billing: 'separate', feePence: null },
        defaultFeePence: DEFAULT_DRONE_FEE_PENCE,
      }),
    ).toEqual({ label: 'Drone', amount: '£150' });
  });

  it('uses a typed fee over the default', () => {
    expect(
      droneQuoteLine({
        drone: { used: true, billing: 'separate', feePence: 20_000 },
        defaultFeePence: DEFAULT_DRONE_FEE_PENCE,
      })?.amount,
    ).toBe('£200');
  });

  it('shows included drones without a fee', () => {
    expect(
      droneQuoteLine({
        drone: { used: true, billing: 'included', feePence: 20_000 },
        defaultFeePence: DEFAULT_DRONE_FEE_PENCE,
      }),
    ).toEqual({ label: 'Drone', amount: 'Included' });
  });
});

describe('mapSurveyDrone', () => {
  it('defaults safely for rows without drone columns', () => {
    expect(mapSurveyDrone({})).toEqual({
      used: false,
      billing: 'separate',
      feePence: null,
    });
  });

  it('reads the stored values', () => {
    expect(
      mapSurveyDrone({
        survey_drone_used: true,
        survey_drone_billing: 'included',
        survey_drone_fee_pence: 12_500,
      }),
    ).toEqual({ used: true, billing: 'included', feePence: 12_500 });
  });
});

describe('droneReportText', () => {
  it('states whether a drone was used', () => {
    expect(droneReportText(true)).toMatch(/^Yes/);
    expect(droneReportText(false)).toBe('No.');
  });
});
