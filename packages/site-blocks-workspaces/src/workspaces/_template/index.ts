import { manifestToPuckConfig } from '../../manifest-to-config';
import type { BlockManifest, WorkspaceBlockPack } from '../../types';
import featureBandManifest from './example-feature/block.manifest.json';
import { TemplateFeatureBand } from './example-feature/component';

/**
 * Template workspace pack. Copy this folder to
 * `src/workspaces/{accountSlug}/`, rename the block types with your
 * workspace prefix (e.g. `YbbHero`), then register the pack in
 * `src/registry.ts`.
 *
 * NOTE: `_template` is intentionally NOT registered in the registry.
 */
export const templatePack: WorkspaceBlockPack = {
  slug: '_template',
  label: 'Template workspace',
  components: {
    [featureBandManifest.type]: manifestToPuckConfig(
      featureBandManifest as BlockManifest,
      TemplateFeatureBand,
    ),
  },
  categories: {
    template: {
      title: 'Template workspace',
      components: [featureBandManifest.type],
    },
  },
};
