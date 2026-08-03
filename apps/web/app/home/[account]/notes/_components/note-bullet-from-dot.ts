'use client';

import { Extension, wrappingInputRule } from '@tiptap/react';

/**
 * Convert a leading `•` into a real bullet list when the user types
 * space or Enter afterwards (StarterKit only matches -, +, *).
 */
export const BulletFromDot = Extension.create({
  name: 'bulletFromDot',

  addInputRules() {
    const type = this.editor.schema.nodes.bulletList;
    if (!type) return [];

    return [
      wrappingInputRule({
        find: /^\s*•\s$/,
        type,
      }),
    ];
  },

  addKeyboardShortcuts() {
    const convertLoneBullet = () => {
      const { state } = this.editor;
      const { $from } = state.selection;

      if ($from.parent.type.name !== 'paragraph') {
        return false;
      }

      const text = $from.parent.textContent;
      if (text.trim() !== '•') {
        return false;
      }

      if ($from.parentOffset < text.length) {
        return false;
      }

      return this.editor
        .chain()
        .focus()
        .deleteRange({ from: $from.start(), to: $from.end() })
        .toggleBulletList()
        .run();
    };

    return {
      Space: convertLoneBullet,
      Enter: convertLoneBullet,
    };
  },
});
