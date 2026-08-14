'use client';

import { useCallback, useEffect, useRef } from 'react';

export type CommandUndoEntry = {
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
  label?: string;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

/**
 * Browser-style Cmd/Ctrl+Z undo and Cmd/Ctrl+Shift+Z redo for in-app actions.
 * Skips when focus is in a text field so native undo still works there.
 */
export function useCommandUndoStack(options?: { max?: number }) {
  const undoStackRef = useRef<CommandUndoEntry[]>([]);
  const redoStackRef = useRef<CommandUndoEntry[]>([]);
  const max = options?.max ?? 40;

  const push = useCallback(
    (entry: CommandUndoEntry) => {
      undoStackRef.current.push(entry);
      if (undoStackRef.current.length > max) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
    },
    [max],
  );

  const undo = useCallback(async () => {
    const entry = undoStackRef.current.pop();
    if (!entry) return false;
    await entry.undo();
    redoStackRef.current.push(entry);
    return true;
  }, []);

  const redo = useCallback(async () => {
    const entry = redoStackRef.current.pop();
    if (!entry) return false;
    await entry.redo();
    undoStackRef.current.push(entry);
    return true;
  }, []);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'z') return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      if (event.shiftKey) {
        void redo();
      } else {
        void undo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  return { push, undo, redo, clear };
}
