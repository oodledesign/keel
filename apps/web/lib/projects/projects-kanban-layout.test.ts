import { describe, expect, it } from 'vitest';

import {
  isKanbanColumnMinimized,
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
  it('pins the heading to the column viewport', () => {
    expect(kanbanColumnHeaderClassName()).toContain('sticky top-0');
  });
});

describe('kanbanColumnClassName', () => {
  it('still exposes a droppable surface when empty', () => {
    const className = kanbanColumnClassName({
      isEmpty: true,
      isOver: true,
    });

    expect(className).toContain('h-full');
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
