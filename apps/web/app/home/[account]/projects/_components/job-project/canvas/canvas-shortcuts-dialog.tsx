'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

type Shortcut = { keys: string[]; label: string };

const GROUPS: Array<{ title: string; shortcuts: Shortcut[] }> = [
  {
    title: 'Create',
    shortcuts: [
      { keys: ['N'], label: 'New project note' },
      { keys: ['S'], label: 'Sticky note' },
      { keys: ['T'], label: 'Text' },
      { keys: ['R'], label: 'Shape' },
      { keys: ['F'], label: 'Section' },
      { keys: ['M'], label: 'Figure (big number with a target)' },
      { keys: ['K'], label: 'Add a task' },
      { keys: ['C'], label: 'Arrow' },
      { keys: ['P'], label: 'Pen' },
      { keys: ['E'], label: 'Eraser' },
    ],
  },
  {
    title: 'Edit',
    shortcuts: [
      { keys: ['⌘', 'C'], label: 'Copy' },
      { keys: ['⌘', 'X'], label: 'Cut' },
      { keys: ['⌘', 'V'], label: 'Paste — items, images, files or links' },
      { keys: ['⌘', 'D'], label: 'Duplicate' },
      { keys: ['⌫'], label: 'Delete' },
      { keys: ['⌘', 'Z'], label: 'Undo' },
      { keys: ['⇧', '⌘', 'Z'], label: 'Redo' },
      { keys: ['⌘', 'B'], label: 'Bold' },
      { keys: ['⌘', 'I'], label: 'Italic' },
      { keys: ['⌥', '⌘', 'G'], label: 'Wrap in section' },
    ],
  },
  {
    title: 'Select & arrange',
    shortcuts: [
      { keys: ['V'], label: 'Select tool' },
      { keys: ['⌘', 'A'], label: 'Select all' },
      { keys: ['↵'], label: 'Open or edit the selected item' },
      { keys: ['←', '↑', '→', '↓'], label: 'Nudge (hold ⇧ for 10px)' },
      { keys: ['⌘', ']'], label: 'Bring to front' },
      { keys: ['⌘', '['], label: 'Send to back' },
      { keys: ['Esc'], label: 'Cancel tool / exit full screen' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: ['H'], label: 'Pan tool' },
      { keys: ['+'], label: 'Zoom in' },
      { keys: ['−'], label: 'Zoom out' },
      { keys: ['⇧', '1'], label: 'Zoom to fit everything' },
      { keys: ['⇧', '2'], label: 'Zoom to selection' },
      { keys: ['⇧', '0'], label: 'Zoom to 100%' },
      { keys: ['⇧', 'F'], label: 'Full screen' },
      { keys: ['⌘', 'F'], label: 'Search the canvas' },
      { keys: ['?'], label: 'Show these shortcuts' },
    ],
  },
];

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-1.5 font-mono text-[11px] text-[var(--workspace-shell-text)]">
      {children}
    </kbd>
  );
}

export function CanvasShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            On Windows, use Ctrl in place of ⌘ and Alt in place of ⌥.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group.title} className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{shortcut.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <Key key={key}>{key}</Key>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
