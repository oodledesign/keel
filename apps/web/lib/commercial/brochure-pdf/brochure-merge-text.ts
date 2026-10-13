import { InputRule, Node } from '@tiptap/react';

import {
  BROCHURE_MERGE_TOKEN,
  brochureMergeFieldToken,
  findBrochureMergeField,
} from '~/lib/commercial/brochure-pdf/brochure-merge-fields';

/** A listing detail shown as a pill in the editor; its text is `{Label}`. */
export const BrochureMergeFieldNode = Node.create<{ pillClass: string }>({
  name: 'mergeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { pillClass: '' };
  },

  addAttributes() {
    return { label: { default: '' } };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-merge-field]',
        getAttrs: (el) => ({
          label: (el as HTMLElement).dataset.mergeField ?? '',
        }),
      },
    ];
  },

  renderHTML({ node }) {
    const label = String(node.attrs.label);
    return [
      'span',
      { 'data-merge-field': label, class: this.options.pillClass },
      label,
    ];
  },

  renderText({ node }) {
    return brochureMergeFieldToken(String(node.attrs.label));
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\{([^{}\n]{1,40})\}$/,
        handler: ({ state, range, match }) => {
          const field = findBrochureMergeField(match[1] ?? '');
          if (!field) return null;
          state.tr.replaceWith(
            range.from,
            range.to,
            this.type.create({ label: field.label }),
          );
        },
      }),
    ];
  },
});

/** Top node for one-line fields: a single paragraph. */
export const SingleLineDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'paragraph',
});

/** The editor's JSON for plain text with `{Field}` merge fields as pill nodes. */
export type MergeTextNode =
  | { type: 'text'; text: string }
  | { type: 'mergeField'; attrs: { label: string } };

export type MergeTextParagraph = {
  type: 'paragraph';
  content?: MergeTextNode[];
};

export type MergeTextDoc = { type: 'doc'; content: MergeTextParagraph[] };

/** Known `{Field}` tokens become pills; anything else stays as typed. */
export function mergeTextLine(line: string): MergeTextNode[] | undefined {
  const out: MergeTextNode[] = [];
  let last = 0;
  for (const match of line.matchAll(BROCHURE_MERGE_TOKEN)) {
    const field = findBrochureMergeField(match[1] ?? '');
    if (!field) continue;
    if (match.index > last) {
      out.push({ type: 'text', text: line.slice(last, match.index) });
    }
    out.push({ type: 'mergeField', attrs: { label: field.label } });
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push({ type: 'text', text: line.slice(last) });
  return out.length > 0 ? out : undefined;
}

/** Single-line fields fold line breaks into spaces. */
export function mergeTextLines(text: string, multiline: boolean): string[] {
  const normalised = text.replace(/\r\n?/g, '\n');
  return multiline
    ? normalised.split('\n')
    : [normalised.replace(/\s*\n\s*/g, ' ')];
}

export function mergeTextDoc(text: string, multiline: boolean): MergeTextDoc {
  return {
    type: 'doc',
    content: mergeTextLines(text, multiline).map((line) => ({
      type: 'paragraph',
      content: mergeTextLine(line),
    })),
  };
}
