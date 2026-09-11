import { describe, expect, it } from 'vitest';

import {
  kanbanColumnClassName,
  kanbanColumnWidthClass,
} from './projects-kanban-layout';

describe('kanbanColumnWidthClass', () => {
  it('keeps filled columns at the existing board width', () => {
    expect(kanbanColumnWidthClass(false)).toBe('w-[min(100%,240px)] md:w-60');
  });

  it('compresses empty status columns without hiding them', () => {
    expect(kanbanColumnWidthClass(true)).toBe(
      'w-[5.5rem] min-w-[5.5rem] md:w-24',
    );
  });
});

describe('kanbanColumnClassName', () => {
  it('still exposes a droppable surface when empty', () => {
    const className = kanbanColumnClassName({
      isEmpty: true,
      isOver: true,
    });

    expect(className).toContain('min-h-[280px]');
    expect(className).toContain('w-[5.5rem]');
    expect(className).toContain('border-[var(--ozer-accent)]/40');
  });
});
