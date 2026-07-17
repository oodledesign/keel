import { manifestToPuckConfig } from '../../manifest-to-config';
import type { BlockManifest, WorkspaceBlockPack } from '../../types';
import ybbFooterManifest from './ybb-footer/block.manifest.json';
import { YbbFooter } from './ybb-footer/component';
import ybbHeroManifest from './ybb-hero/block.manifest.json';
import { YbbHero } from './ybb-hero/component';

/**
 * Your Bridal Besties custom blocks for the Oodle workspace.
 *
 * Registered under workspace `accounts.slug` `oodle` (agency workspace).
 * Block types stay `Ybb*` — client-prefixed to avoid core collisions.
 */
export const ybbPack: WorkspaceBlockPack = {
  slug: 'oodle',
  label: 'Your Bridal Besties',
  components: {
    [ybbHeroManifest.type]: manifestToPuckConfig(
      ybbHeroManifest as BlockManifest,
      YbbHero,
    ),
    [ybbFooterManifest.type]: manifestToPuckConfig(
      ybbFooterManifest as BlockManifest,
      YbbFooter,
    ),
  },
  categories: {
    ybb: {
      title: 'Your Bridal Besties',
      components: [ybbHeroManifest.type, ybbFooterManifest.type],
    },
  },
};
