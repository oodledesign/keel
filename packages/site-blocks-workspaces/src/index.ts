export { manifestToPuckConfig } from './manifest-to-config';
/** Example pack — reference for new workspace packs; never registered. */
export { templatePack } from './workspaces/_template';
export { getWorkspacePack, listWorkspacePackSlugs } from './registry';
export { resolveSiteBlocksConfig } from './resolve-config';
export type {
  BlockManifest,
  BlockManifestField,
  BlockManifestFieldType,
  WorkspaceBlockPack,
} from './types';
