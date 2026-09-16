import { describe, expect, it } from 'vitest';

import {
  isKanbanColumnMinimized,
  kanbanBoardClassName,
  kanbanColumnCardsClassName,
  kanbanColumnClassName,
  kanbanColumnHeaderClassName,
  kanbanColumnInitials,
  kanbanColumnWidthClass,
} from './projects-kanban-layout';

describe('kanbanColumnInitials', () => {
  it('uses the first letter of each word', () => {
    expect(kanbanColumnInitials('Contract Sent')).toBe('CS');
    expect(kanbanColumnInitials('On Hold')).toBe('OH');
    expect(kanbanColumnInitials('In Progress')).toBe('IP');
    expect(kanbanColumnInitials('Completed')).toBe('C');
    expect(kanbanColumnInitials('Cancelled')).toBe('C');
    expect(kanbanColumnInitials('Invoiced')).toBe('I');
  });

  it('ignores punctuation and extra space', () => {
    expect(kanbanColumnInitials('  to-do  ')).toBe('TD');
    expect(kanbanColumnInitials('')).toBe('');
  });
});

describe('isKanbanColumnMinimized', () => {
  it('minimizes empty columns until a card is dragged over them', () => {
    expect(isKanbanColumnMinimized({ isEmpty: true, isOver: false })).toBe(
      true,
    );
    expect(isKanbanColumnMinimized({ isEmpty: true, isOver: true })).toBe(
      false,
    );
    expect(isKanbanColumnMinimized({ isEmpty: false, isOver: false })).toBe(
      false,
    );
  });
});

describe('kanbanColumnWidthClass', () => {
  it('keeps filled columns at the existing board width', () => {
    expect(kanbanColumnWidthClass(false)).toBe('w-[min(100%,240px)] md:w-60');
  });

  it('compresses empty status columns to initials-only chrome', () => {
    expect(kanbanColumnWidthClass(true)).toBe('w-10 min-w-10');
  });
});

describe('kanbanColumnHeaderClassName', () => {
  it('pins the heading to the board scroller', () => {
    expect(kanbanColumnHeaderClassName()).toContain('sticky top-0');
  });
});

describe('kanbanColumnClassName', () => {
  it('still exposes a droppable surface when empty', () => {
    const className = kanbanColumnClassName({
      isEmpty: true,
      isOver: true,
    });

    expect(className).toContain('min-h-full');
    expect(className).toContain('overflow-visible');
    expect(className).not.toContain('overflow-hidden');
    expect(className).toContain('md:w-60');
    expect(className).not.toContain('w-10');
    expect(className).toContain('border-[var(--ozer-accent)]/40');
    expect(className).toContain('duration-200');
  });

  it('keeps empty idle columns lean', () => {
    const className = kanbanColumnClassName({
      isEmpty: true,
      isOver: false,
    });

    expect(className).toContain('w-10');
    expect(className).not.toContain('md:w-60');
  });
});

describe('kanbanBoardClassName', () => {
  it('scrolls the board vertically so sticky headers can pin', () => {
    expect(kanbanBoardClassName).toContain('overflow-auto');
    expect(kanbanBoardClassName).not.toContain('overflow-y-hidden');
    expect(kanbanBoardClassName).toContain('items-stretch');
  });
});

describe('kanbanColumnCardsClassName', () => {
  it('does not create a nested column scroller that traps sticky', () => {
    expect(kanbanColumnCardsClassName()).not.toContain('overflow-y-auto');
    expect(kanbanColumnCardsClassName({ isEmpty: true })).toContain(
      'min-h-[200px]',
    );
  });
});
