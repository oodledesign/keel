import {
  Building2,
  CheckSquare,
  ClipboardList,
  LayoutDashboard,
  StickyNote,
  UserRound,
} from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { resolveNavSearchCategoryVisual } from './nav-search-category-icon';

describe('resolveNavSearchCategoryVisual', () => {
  it('maps Disposal to Building2 + accent', () => {
    const visual = resolveNavSearchCategoryVisual('Bracketts · Disposal');
    expect(visual.Icon).toBe(Building2);
    expect(visual.className).toContain('--ozer-accent');
  });

  it('maps Contact to UserRound + info', () => {
    const visual = resolveNavSearchCategoryVisual('Bracketts · Contact');
    expect(visual.Icon).toBe(UserRound);
    expect(visual.className).toContain('--ozer-info');
  });

  it('maps Requirement and Project kinds', () => {
    expect(resolveNavSearchCategoryVisual('Bracketts · Requirement').Icon).toBe(
      ClipboardList,
    );
    expect(resolveNavSearchCategoryVisual('Bracketts · Project').Icon).toBe(
      CheckSquare,
    );
    expect(resolveNavSearchCategoryVisual('Bracketts · Note').Icon).toBe(
      StickyNote,
    );
  });

  it('falls back to nav page label when category is workspace-only', () => {
    expect(
      resolveNavSearchCategoryVisual('Bracketts', {
        label: 'Bracketts — Disposals',
      }).Icon,
    ).toBe(Building2);
    expect(
      resolveNavSearchCategoryVisual('Bracketts', {
        label: 'Bracketts — Contacts',
      }).Icon,
    ).toBe(UserRound);
  });

  it('defaults when category/label give no kind', () => {
    expect(resolveNavSearchCategoryVisual(undefined).Icon).toBe(
      LayoutDashboard,
    );
    expect(resolveNavSearchCategoryVisual('Bracketts').Icon).toBe(
      LayoutDashboard,
    );
  });
});
