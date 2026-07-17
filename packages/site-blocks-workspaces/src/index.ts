export { manifestToPuckConfig } from './manifest-to-config';
/** Example pack — reference for new workspace packs; never registered. */
export { templatePack } from './workspaces/_template';
/** Your Bridal Besties custom blocks — registered for Oodle workspace slug `oodle`. */
export { ybbPack } from './workspaces/ybb';
export { getWorkspacePack, listWorkspacePackSlugs } from './registry';
export { resolveSiteBlocksConfig } from './resolve-config';
export type {
  BlockManifest,
  BlockManifestField,
  BlockManifestFieldType,
  WorkspaceBlockPack,
} from './types';
