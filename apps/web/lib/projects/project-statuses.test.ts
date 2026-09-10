import { describe, expect, it } from 'vitest';

import {
  closedProjectStatusSlugs,
  contrastTextOnStatusColor,
  defaultProjectStatusSlug,
  fallbackProjectStatuses,
  getProjectGroupId,
  projectStatusLabel,
  slugifyProjectStatusLabel,
  uniqueProjectStatusSlug,
} from './project-statuses';

describe('project status helpers', () => {
  it('slugifies labels for custom pipeline statuses', () => {
    expect(slugifyProjectStatusLabel('Invoiced')).toBe('invoiced');
    expect(slugifyProjectStatusLabel('Ready for review')).toBe(
      'ready_for_review',
    );
    expect(slugifyProjectStatusLabel('  ')).toBe('status');
  });

  it('avoids colliding slugs', () => {
    expect(uniqueProjectStatusSlug('Invoiced', ['invoiced'])).toBe(
      'invoiced_2',
    );
  });

  it('uses workspace labels and falls back to built-in names', () => {
    const statuses = fallbackProjectStatuses('acc-1');
    statuses.push({
      id: 'custom',
      accountId: 'acc-1',
      slug: 'invoiced',
      label: 'Invoiced',
      color: '#41606F',
      sortOrder: 5,
      isDefault: false,
      category: 'open',
    });

    expect(projectStatusLabel('invoiced', statuses)).toBe('Invoiced');
    expect(projectStatusLabel('pending', [])).toBe('Pending');
    expect(projectStatusLabel('awaiting_signoff', [])).toBe('awaiting signoff');
  });

  it('classifies custom statuses from category', () => {
    const statuses = fallbackProjectStatuses('acc-1');
    statuses.push({
      id: 'custom',
      accountId: 'acc-1',
      slug: 'invoiced',
      label: 'Invoiced',
      color: '#41606F',
      sortOrder: 5,
      isDefault: false,
      category: 'open',
    });

    expect(getProjectGroupId('invoiced', statuses)).toBe('ongoing');
    expect(getProjectGroupId('completed', statuses)).toBe('completed');
    expect(closedProjectStatusSlugs(statuses)).toEqual([
      'completed',
      'cancelled',
    ]);
    expect(defaultProjectStatusSlug(statuses)).toBe('pending');
  });

  it('picks dark text on light status colours', () => {
    expect(contrastTextOnStatusColor('#F0C14B')).toBe('#2A1720');
    expect(contrastTextOnStatusColor('#41606F')).toBe('#FFFFFF');
  });
});
