import { describe, expect, it } from 'vitest';

import {
  cardCompositeId,
  fromSharedStatus,
  parseCardCompositeId,
  parseWipBoardView,
  toSharedStatus,
} from './wip-board-mapping';

describe('wip-board-mapping', () => {
  it('parses view query with instructions default', () => {
    expect(parseWipBoardView(null)).toBe('instructions');
    expect(parseWipBoardView('both')).toBe('both');
    expect(parseWipBoardView('garbage')).toBe('instructions');
  });

  it('maps instruction stages into shared columns', () => {
    expect(toSharedStatus('instruction', 'potential')).toBe('new');
    expect(toSharedStatus('instruction', 'enquiry')).toBe('new');
    expect(toSharedStatus('instruction', 'current')).toBe('active');
    expect(toSharedStatus('instruction', 'viewing')).toBe('active');
    expect(toSharedStatus('instruction', 'under_offer_negotiating')).toBe(
      'under_offer_negotiating',
    );
    expect(toSharedStatus('instruction', 'completed_exchanged')).toBe(
      'closed',
    );
    expect(toSharedStatus('instruction', 'fallen_through')).toBe('closed');
  });

  it('maps requirement stages into shared columns', () => {
    expect(toSharedStatus('requirement', 'new')).toBe('new');
    expect(toSharedStatus('requirement', 'unactioned')).toBe('new');
    expect(toSharedStatus('requirement', 'actively_searching')).toBe('active');
    expect(toSharedStatus('requirement', 'search')).toBe('active');
    expect(toSharedStatus('requirement', 'under_offer_negotiating')).toBe(
      'under_offer_negotiating',
    );
    expect(toSharedStatus('requirement', 'fulfilled')).toBe('closed');
    expect(toSharedStatus('requirement', 'withdrawn')).toBe('closed');
  });

  it('maps shared columns back to native stages with closed choices', () => {
    expect(fromSharedStatus('instruction', 'new')).toBe('potential');
    expect(fromSharedStatus('instruction', 'active')).toBe('current');
    expect(fromSharedStatus('instruction', 'closed')).toBe(
      'completed_exchanged',
    );
    expect(fromSharedStatus('instruction', 'closed', 'fallen_through')).toBe(
      'fallen_through',
    );

    expect(fromSharedStatus('requirement', 'new')).toBe('new');
    expect(fromSharedStatus('requirement', 'active')).toBe(
      'actively_searching',
    );
    expect(fromSharedStatus('requirement', 'closed')).toBe('fulfilled');
    expect(fromSharedStatus('requirement', 'closed', 'withdrawn')).toBe(
      'withdrawn',
    );
  });

  it('builds and parses composite card ids', () => {
    expect(cardCompositeId('instruction', 'abc')).toBe('instruction:abc');
    expect(parseCardCompositeId('requirement:uuid-1')).toEqual({
      kind: 'requirement',
      id: 'uuid-1',
    });
    expect(parseCardCompositeId('nope')).toBeNull();
  });
});
