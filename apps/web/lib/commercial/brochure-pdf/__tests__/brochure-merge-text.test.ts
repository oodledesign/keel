import {
  getSchema,
  getText,
  getTextSerializersFromSchema,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';

import {
  BrochureMergeFieldNode,
  SingleLineDocument,
  mergeTextDoc,
} from '../brochure-merge-text';

function roundTrip(text: string, multiline: boolean) {
  const schema = getSchema([
    StarterKit.configure({ document: multiline ? undefined : false }),
    ...(multiline ? [] : [SingleLineDocument]),
    BrochureMergeFieldNode,
  ]);
  const doc = schema.nodeFromJSON(mergeTextDoc(text, multiline));
  doc.check();
  return getText(doc, {
    blockSeparator: '\n',
    textSerializers: getTextSerializersFromSchema(schema),
  });
}

describe('mergeTextDoc', () => {
  it('turns known fields into pills and keeps other braces as typed', () => {
    expect(
      mergeTextDoc('{Rent} pa, {Unknown} and {use  class}', false),
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mergeField', attrs: { label: 'Rent' } },
            { type: 'text', text: ' pa, {Unknown} and ' },
            { type: 'mergeField', attrs: { label: 'Use class' } },
          ],
        },
      ],
    });
  });

  it('gives each line its own paragraph, keeping blank lines', () => {
    expect(roundTrip('First {Town}\n\n{Size}\nLast', true)).toBe(
      'First {Town}\n\n{Size}\nLast',
    );
  });

  it('round-trips single-line text, folding line breaks into spaces', () => {
    expect(roundTrip('{Disposal} in {Town}', false)).toBe(
      '{Disposal} in {Town}',
    );
    expect(roundTrip('One\r\ntwo', false)).toBe('One two');
    expect(roundTrip('', false)).toBe('');
  });
});
