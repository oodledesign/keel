import type { ReactNode } from 'react';

import type { ComponentConfig, Field } from '@puckeditor/core';

import type { BlockManifest, BlockManifestField } from './types';

function fieldToPuckField(field: BlockManifestField): Field {
  switch (field.type) {
    case 'text':
      return { type: 'text', label: field.label };
    case 'textarea':
      return { type: 'textarea', label: field.label };
    case 'number':
      return { type: 'number', label: field.label };
    case 'select':
      return {
        type: 'select',
        label: field.label,
        options: field.options ?? [],
      };
    // v1: images and links are edited as plain URLs / hrefs.
    case 'image':
    case 'link':
      return { type: 'text', label: field.label };
    case 'array': {
      const arrayFields: Record<string, Field> = {};
      for (const item of field.itemFields ?? []) {
        arrayFields[item.key] = fieldToPuckField(item);
      }
      const firstKey = (field.itemFields ?? [])[0]?.key;
      // Cast: ArrayField.getItemSummary is generic over item props and is
      // not expressible through the bare `Field` union we return here.
      return {
        type: 'array',
        label: field.label,
        arrayFields,
        getItemSummary: (item: Record<string, unknown>, index?: number) => {
          const value = firstKey ? item[firstKey] : undefined;
          return typeof value === 'string' && value.length > 0
            ? value
            : `${field.itemLabel ?? 'Item'} ${(index ?? 0) + 1}`;
        },
      } as unknown as Field;
    }
  }
}

/**
 * Convert a `block.manifest.json` written in Cursor into a Puck
 * `ComponentConfig`, wiring the manifest's fields + defaults to the
 * provided React component.
 */
export function manifestToPuckConfig<Props>(
  manifest: BlockManifest,
  Component: (props: Props) => ReactNode,
): ComponentConfig {
  const fields: Record<string, Field> = {};
  for (const field of manifest.fields) {
    fields[field.key] = fieldToPuckField(field);
  }

  return {
    label: manifest.label,
    fields,
    defaultProps: manifest.defaults ?? {},
    // Cast: Puck's render type is generic over the component's props map,
    // which is erased here — Puck calls it with the deserialized props bag.
    render: Component as unknown as ComponentConfig['render'],
  } as ComponentConfig;
}
