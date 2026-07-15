import registryJson from './registry/site-blocks-registry.json';

export { resolveTokens, resolveTokensStyle } from './tokens/resolve-tokens';
export type { ResolvableStyleTokens } from './tokens/resolve-tokens';

export { buildConfig, defaultSiteBlocksConfig } from './config';
export type {
  BuildConfigOptions,
  SiteBlocksConfig,
  SiteBlocksPropsMap,
} from './config';

export {
  BLOCK_TO_LAYOUT_PRESET,
  LAYOUT_PRESET_TO_BLOCK,
  LEGACY_LIBRARY_KEY_TO_PRESET,
  SITE_BLOCK_LAYOUT_PRESETS,
  SITE_BLOCK_TYPES,
  resolveBlockType,
  resolveLayoutPreset,
} from './mapping';
export type { SiteBlockLayoutPreset, SiteBlockType } from './mapping';

export { sectionToBlockProps, sectionsToPuckData } from './puck-data';
export type { WireframeSectionInput } from './puck-data';

export {
  WireframeModeProvider,
  useWireframeMode,
} from './context/wireframe-mode';
export {
  SiteMediaUploadProvider,
  useSiteMediaUploader,
  SiteImageField,
} from './context/site-media';
export type { SiteMediaUploader } from './context/site-media';

export { Render } from '@puckeditor/core';

export {
  CtaButton,
  ItemCard,
  MediaPlaceholder,
  OutlineText,
  SectionShell,
} from './primitives';

export const siteBlocksRegistry = registryJson;
