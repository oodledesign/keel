import { manifestToPuckConfig } from '../../manifest-to-config';
import type { BlockManifest, WorkspaceBlockPack } from '../../types';
import ybbAnnouncementBannerManifest from './ybb-announcement-banner/block.manifest.json';
import { YbbAnnouncementBanner } from './ybb-announcement-banner/component';
import ybbFooterManifest from './ybb-footer/block.manifest.json';
import { YbbFooter } from './ybb-footer/component';
import ybbFoundersManifest from './ybb-founders/block.manifest.json';
import { YbbFounders } from './ybb-founders/component';
import ybbGlamGirlsManifest from './ybb-glam-girls/block.manifest.json';
import { YbbGlamGirls } from './ybb-glam-girls/component';
import ybbHeroManifest from './ybb-hero/block.manifest.json';
import { YbbHero } from './ybb-hero/component';
import ybbNavbarManifest from './ybb-navbar/block.manifest.json';
import { YbbNavbar } from './ybb-navbar/component';
import ybbPortfolioManifest from './ybb-portfolio/block.manifest.json';
import { YbbPortfolio } from './ybb-portfolio/component';
import ybbScallopSectionManifest from './ybb-scallop-section/block.manifest.json';
import { YbbScallopSection } from './ybb-scallop-section/component';

const YBB_COMPONENT_ORDER = [
  ybbAnnouncementBannerManifest.type,
  ybbNavbarManifest.type,
  ybbHeroManifest.type,
  ybbScallopSectionManifest.type,
  ybbGlamGirlsManifest.type,
  ybbFoundersManifest.type,
  ybbPortfolioManifest.type,
  ybbFooterManifest.type,
] as const;

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
    [ybbAnnouncementBannerManifest.type]: manifestToPuckConfig(
      ybbAnnouncementBannerManifest as BlockManifest,
      YbbAnnouncementBanner,
    ),
    [ybbNavbarManifest.type]: manifestToPuckConfig(
      ybbNavbarManifest as BlockManifest,
      YbbNavbar,
    ),
    [ybbHeroManifest.type]: manifestToPuckConfig(
      ybbHeroManifest as BlockManifest,
      YbbHero,
    ),
    [ybbScallopSectionManifest.type]: manifestToPuckConfig(
      ybbScallopSectionManifest as BlockManifest,
      YbbScallopSection,
    ),
    [ybbGlamGirlsManifest.type]: manifestToPuckConfig(
      ybbGlamGirlsManifest as BlockManifest,
      YbbGlamGirls,
    ),
    [ybbFoundersManifest.type]: manifestToPuckConfig(
      ybbFoundersManifest as BlockManifest,
      YbbFounders,
    ),
    [ybbPortfolioManifest.type]: manifestToPuckConfig(
      ybbPortfolioManifest as BlockManifest,
      YbbPortfolio,
    ),
    [ybbFooterManifest.type]: manifestToPuckConfig(
      ybbFooterManifest as BlockManifest,
      YbbFooter,
    ),
  },
  categories: {
    ybb: {
      title: 'Your Bridal Besties',
      components: [...YBB_COMPONENT_ORDER],
    },
  },
};
