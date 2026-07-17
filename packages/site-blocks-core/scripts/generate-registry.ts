import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildConfig } from '../src/config';
import {
  BLOCK_TO_LAYOUT_PRESET,
  SITE_BLOCK_TYPES,
  type SiteBlockType,
} from '../src/mapping';

type FieldSchema = {
  name: string;
  type: string;
  label?: string;
};

function fieldsToSchema(
  fields: Record<string, { type?: string; label?: string } | undefined>,
): FieldSchema[] {
  return Object.entries(fields).map(([name, field]) => ({
    name,
    type: field?.type ?? 'text',
    label: field?.label,
  }));
}

function intendedUse(type: SiteBlockType): string {
  const uses: Record<SiteBlockType, string> = {
    Header: 'Site-wide navigation / brand chrome',
    HeroSplit: 'Primary page hero with media + dual CTAs',
    HeroCentered: 'Centered hero for simple landing promises',
    HeroWithForm: 'Lead-capture hero with inline form',
    LogoCloud: 'Social proof logo strip',
    FeatureGrid: '3–6 benefit / service cards',
    FeatureAlternating: 'Split media + copy feature band',
    Testimonials: 'Customer quotes with attribution',
    StatsBar: 'Key numeric proof metrics',
    PricingTable: 'Tiered pricing with feature lists',
    TeamGrid: 'People / team portraits',
    FAQAccordion: 'FAQ / AEO answer blocks',
    CTABand: 'Full-width conversion strip',
    ContactForm: 'Contact details + form',
    MapSection: 'Locations / map / NAP',
    BlogGrid: 'Latest posts grid',
    ContentProse: 'Long-form editorial prose',
    GalleryGrid: 'Image gallery / masonry',
    Footer: 'Site footer columns + legal',
  };
  return uses[type];
}

const config = buildConfig();
const blocks = SITE_BLOCK_TYPES.filter((type) => config.components[type]).map(
  (type) => {
    const component = config.components[type];
    return {
      name: type,
      layoutPreset: BLOCK_TO_LAYOUT_PRESET[type],
      label: component.label ?? type,
      intendedUse: intendedUse(type),
      propsSchema: fieldsToSchema(
        (component.fields ?? {}) as Record<
          string,
          { type?: string; label?: string } | undefined
        >,
      ),
      defaultProps: component.defaultProps ?? {},
    };
  },
);

const registry = {
  schemaVersion: '1.0',
  package: '@kit/site-blocks-core',
  generatedAt: new Date().toISOString(),
  blocks,
};

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '../src/registry/site-blocks-registry.json');
writeFileSync(outPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
console.log(`Wrote ${blocks.length} blocks → ${outPath}`);
