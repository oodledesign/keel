import type { ComponentConfig, Config } from '@puckeditor/core';

/**
 * Field types supported by the block.manifest.json contract.
 *
 * Kept intentionally small so that a manifest written in Cursor maps
 * deterministically onto Puck fields via `manifestToPuckConfig`.
 */
export type BlockManifestFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'image'
  | 'link'
  | 'array';

export type BlockManifestField = {
  /** Prop key on the React component. */
  key: string;
  type: BlockManifestFieldType;
  /** Human label shown in the Puck sidebar. */
  label: string;
  /** For type: 'select' — allowed values. */
  options?: { label: string; value: string }[];
  /** For type: 'array' — the shape of each item. */
  itemFields?: BlockManifestField[];
  /** For type: 'array' — label template, e.g. 'Item'. */
  itemLabel?: string;
};

/**
 * Per-block contract produced in Cursor (`block.manifest.json`).
 *
 * `type` is the Puck component type. Use PascalCase and prefix with the
 * workspace, e.g. `YbbHero`, to avoid collisions with core blocks.
 */
export type BlockManifest = {
  type: string;
  label: string;
  /** Sidebar category key, e.g. 'ybb'. */
  category?: string;
  fields: BlockManifestField[];
  /** Default props applied when the block is dropped onto the canvas. */
  defaults?: Record<string, unknown>;
};

/**
 * A workspace pack: the set of custom blocks available to one workspace
 * (keyed by `accounts.slug`) across all of its sites.
 */
export type WorkspaceBlockPack = {
  /** Workspace account slug this pack belongs to. */
  slug: string;
  /** Display name shown in Site Studio. */
  label: string;
  /** Puck component configs keyed by block type. */
  components: Record<string, ComponentConfig>;
  /** Optional sidebar categories for these components. */
  categories?: Config['categories'];
};
