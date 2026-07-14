'use client';

import type { ComponentConfig } from '@puckeditor/core';

import { SiteImageField } from '../context/site-media';
import { useWireframeMode } from '../context/wireframe-mode';
import {
  CtaButton,
  ItemCard,
  MediaPlaceholder,
  OutlineText,
  SectionShell,
} from '../primitives';

type PuckMeta = {
  puck?: { metadata?: { wireframe?: boolean } };
};

function wireFrom(props: PuckMeta) {
  return Boolean(props.puck?.metadata?.wireframe);
}

/* ------------------------------------------------------------------ */
/* Shared field helpers                                                */
/* ------------------------------------------------------------------ */

const text = (label: string) => ({ type: 'text' as const, label });
const area = (label: string) => ({ type: 'textarea' as const, label });

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

export type HeaderProps = {
  brandName: string;
  link1: string;
  link2: string;
  link3: string;
  ctaLabel: string;
};

export function Header({
  brandName,
  link1,
  link2,
  link3,
  ctaLabel,
  puck,
}: HeaderProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom({ puck }));
  return (
    <SectionShell
      tone="surface"
      wireframe={wireframe}
      className="border-b border-[var(--sb-border)] !py-[var(--sb-space-4)]"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold tracking-tight">{brandName}</p>
        <nav className="hidden items-center gap-5 text-sm text-[var(--sb-ink-muted)] md:flex">
          <span>{link1}</span>
          <span>{link2}</span>
          <span>{link3}</span>
        </nav>
        <CtaButton label={ctaLabel} />
      </div>
    </SectionShell>
  );
}

export const headerConfig: ComponentConfig<HeaderProps> = {
  label: 'Header',
  fields: {
    brandName: text('Brand name'),
    link1: text('Link 1'),
    link2: text('Link 2'),
    link3: text('Link 3'),
    ctaLabel: text('CTA label'),
  },
  defaultProps: {
    brandName: 'Brand',
    link1: 'Services',
    link2: 'Work',
    link3: 'About',
    ctaLabel: 'Get in touch',
  },
  render: Header,
};

/* ------------------------------------------------------------------ */
/* Heroes                                                              */
/* ------------------------------------------------------------------ */

export type HeroSplitProps = {
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
  imageUrl: string;
};

export function HeroSplit(props: HeroSplitProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  return (
    <SectionShell wireframe={wireframe}>
      <div className="grid items-center gap-[var(--sb-space-8)] md:grid-cols-2">
        <div className="space-y-[var(--sb-space-4)]">
          {props.eyebrow ? (
            <p className="text-xs font-medium tracking-wide text-[var(--sb-ink-muted)] uppercase">
              {props.eyebrow}
            </p>
          ) : null}
          <OutlineText
            as="h1"
            className="text-4xl leading-tight font-semibold md:text-5xl"
          >
            {props.headline}
          </OutlineText>
          <OutlineText className="text-base text-[var(--sb-ink-muted)] md:text-lg">
            {props.subheadline}
          </OutlineText>
          <div className="flex flex-wrap gap-3 pt-2">
            <CtaButton label={props.primaryCta} />
            {props.secondaryCta ? (
              <CtaButton label={props.secondaryCta} variant="secondary" />
            ) : null}
          </div>
        </div>
        {props.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.imageUrl}
            alt=""
            className="h-full min-h-[16rem] w-full rounded-[var(--sb-radius-lg)] object-cover"
          />
        ) : (
          <MediaPlaceholder label={wireframe ? 'Hero media' : 'Hero image'} />
        )}
      </div>
    </SectionShell>
  );
}

export const heroSplitConfig: ComponentConfig<HeroSplitProps> = {
  label: 'Hero — split',
  fields: {
    eyebrow: text('Eyebrow'),
    headline: text('Headline'),
    subheadline: area('Subheadline'),
    primaryCta: text('Primary CTA'),
    secondaryCta: text('Secondary CTA'),
    imageUrl: {
      type: 'custom',
      label: 'Image',
      render: ({ value, onChange }) => (
        <SiteImageField
          value={String(value ?? '')}
          onChange={onChange}
          label="Image"
        />
      ),
    },
  },
  defaultProps: {
    eyebrow: '',
    headline: 'Headline that earns the scroll',
    subheadline: 'Supporting line that clarifies the offer.',
    primaryCta: 'Book a call',
    secondaryCta: 'See work',
    imageUrl: '',
  },
  render: HeroSplit,
};

export type HeroCenteredProps = {
  headline: string;
  subheadline: string;
  primaryCta: string;
};

export function HeroCentered(props: HeroCenteredProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  return (
    <SectionShell wireframe={wireframe}>
      <div className="mx-auto max-w-3xl space-y-[var(--sb-space-4)] text-center">
        <OutlineText
          as="h1"
          className="text-4xl leading-tight font-semibold md:text-5xl"
        >
          {props.headline}
        </OutlineText>
        <OutlineText className="text-base text-[var(--sb-ink-muted)] md:text-lg">
          {props.subheadline}
        </OutlineText>
        <div className="flex justify-center pt-2">
          <CtaButton label={props.primaryCta} />
        </div>
      </div>
      <div className="mt-[var(--sb-space-8)]">
        <MediaPlaceholder aspect="wide" label="Hero media" />
      </div>
    </SectionShell>
  );
}

export const heroCenteredConfig: ComponentConfig<HeroCenteredProps> = {
  label: 'Hero — centered',
  fields: {
    headline: text('Headline'),
    subheadline: area('Subheadline'),
    primaryCta: text('Primary CTA'),
  },
  defaultProps: {
    headline: 'Centered promise',
    subheadline: 'One clear line under the headline.',
    primaryCta: 'Start here',
  },
  render: HeroCentered,
};

export type HeroWithFormProps = {
  headline: string;
  subheadline: string;
  submitLabel: string;
  field1: string;
  field2: string;
};

export function HeroWithForm(props: HeroWithFormProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  return (
    <SectionShell wireframe={wireframe}>
      <div className="grid items-center gap-[var(--sb-space-8)] md:grid-cols-2">
        <div className="space-y-[var(--sb-space-4)]">
          <OutlineText as="h1" className="text-4xl leading-tight font-semibold">
            {props.headline}
          </OutlineText>
          <OutlineText className="text-[var(--sb-ink-muted)]">
            {props.subheadline}
          </OutlineText>
        </div>
        <ItemCard className="space-y-3">
          <div className="h-10 rounded-[var(--sb-radius-sm)] border border-[var(--sb-border)] bg-[var(--sb-canvas)] px-3 py-2 text-sm text-[var(--sb-ink-muted)]">
            {props.field1 || 'Name'}
          </div>
          <div className="h-10 rounded-[var(--sb-radius-sm)] border border-[var(--sb-border)] bg-[var(--sb-canvas)] px-3 py-2 text-sm text-[var(--sb-ink-muted)]">
            {props.field2 || 'Email'}
          </div>
          <CtaButton label={props.submitLabel} className="w-full" />
        </ItemCard>
      </div>
    </SectionShell>
  );
}

export const heroWithFormConfig: ComponentConfig<HeroWithFormProps> = {
  label: 'Hero — with form',
  fields: {
    headline: text('Headline'),
    subheadline: area('Subheadline'),
    field1: text('Field 1 label'),
    field2: text('Field 2 label'),
    submitLabel: text('Submit label'),
  },
  defaultProps: {
    headline: 'Get a free estimate',
    subheadline: 'Tell us about the project.',
    field1: 'Name',
    field2: 'Email',
    submitLabel: 'Send',
  },
  render: HeroWithForm,
};

/* ------------------------------------------------------------------ */
/* Proof / features                                                    */
/* ------------------------------------------------------------------ */

export type LogoCloudProps = {
  eyebrow: string;
  logos: string;
};

export function LogoCloud(props: LogoCloudProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  const logos = (props.logos || 'Logo A, Logo B, Logo C, Logo D')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    <SectionShell
      tone="atmosphere"
      wireframe={wireframe}
      className="!py-[var(--sb-space-8)]"
    >
      {props.eyebrow ? (
        <p className="mb-4 text-center text-xs tracking-wide text-[var(--sb-ink-muted)] uppercase">
          {props.eyebrow}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {logos.map((logo) => (
          <div
            key={logo}
            className="flex h-14 items-center justify-center rounded-[var(--sb-radius-sm)] border border-[var(--sb-border)] bg-[var(--sb-surface)] text-xs text-[var(--sb-ink-muted)]"
          >
            {logo}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export const logoCloudConfig: ComponentConfig<LogoCloudProps> = {
  label: 'Logo cloud',
  fields: {
    eyebrow: text('Eyebrow'),
    logos: area('Logos (comma-separated)'),
  },
  defaultProps: {
    eyebrow: 'Trusted by',
    logos: 'Logo A, Logo B, Logo C, Logo D',
  },
  render: LogoCloud,
};

export type FeatureGridProps = {
  heading: string;
  items: Array<{ title: string; body: string }>;
};

export function FeatureGrid(props: FeatureGridProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  const items = props.items?.length
    ? props.items
    : [
        { title: 'Feature one', body: 'Short benefit.' },
        { title: 'Feature two', body: 'Short benefit.' },
        { title: 'Feature three', body: 'Short benefit.' },
      ];
  return (
    <SectionShell wireframe={wireframe}>
      <OutlineText
        as="h2"
        className="mb-[var(--sb-space-8)] text-3xl font-semibold"
      >
        {props.heading}
      </OutlineText>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item, index) => (
          <ItemCard key={`${item.title}-${index}`} className="space-y-2">
            <div className="h-8 w-8 rounded-[var(--sb-radius-sm)] bg-[var(--sb-atmosphere)]" />
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-[var(--sb-ink-muted)]">{item.body}</p>
          </ItemCard>
        ))}
      </div>
    </SectionShell>
  );
}

export const featureGridConfig: ComponentConfig<FeatureGridProps> = {
  label: 'Feature grid',
  fields: {
    heading: text('Heading'),
    items: {
      type: 'array',
      label: 'Features',
      arrayFields: {
        title: text('Title'),
        body: area('Body'),
      },
      defaultItemProps: { title: 'Feature', body: 'Benefit' },
    },
  },
  defaultProps: {
    heading: 'Why choose us',
    items: [
      { title: 'Feature one', body: 'Short benefit.' },
      { title: 'Feature two', body: 'Short benefit.' },
      { title: 'Feature three', body: 'Short benefit.' },
    ],
  },
  render: FeatureGrid,
};

export type FeatureAlternatingProps = {
  heading: string;
  body: string;
  ctaLabel: string;
  mediaSide: 'left' | 'right';
};

export function FeatureAlternating(props: FeatureAlternatingProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  const mediaFirst = props.mediaSide !== 'right';
  return (
    <SectionShell wireframe={wireframe}>
      <div className="grid items-center gap-[var(--sb-space-8)] md:grid-cols-2">
        <div className={mediaFirst ? 'md:order-1' : 'md:order-2'}>
          <MediaPlaceholder label="Feature media" />
        </div>
        <div
          className={`space-y-4 ${mediaFirst ? 'md:order-2' : 'md:order-1'}`}
        >
          <OutlineText as="h2" className="text-3xl font-semibold">
            {props.heading}
          </OutlineText>
          <OutlineText className="text-[var(--sb-ink-muted)]">
            {props.body}
          </OutlineText>
          {props.ctaLabel ? <CtaButton label={props.ctaLabel} /> : null}
        </div>
      </div>
    </SectionShell>
  );
}

export const featureAlternatingConfig: ComponentConfig<FeatureAlternatingProps> =
  {
    label: 'Feature — alternating',
    fields: {
      heading: text('Heading'),
      body: area('Body'),
      ctaLabel: text('CTA'),
      mediaSide: {
        type: 'radio',
        label: 'Media side',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
    },
    defaultProps: {
      heading: 'Detail the next benefit',
      body: 'Supporting copy for the alternating feature band.',
      ctaLabel: 'Learn more',
      mediaSide: 'left',
    },
    render: FeatureAlternating,
  };

export type TestimonialsProps = {
  heading: string;
  items: Array<{ quote: string; name: string; role: string }>;
};

export function Testimonials(props: TestimonialsProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  const items = props.items?.length
    ? props.items
    : [{ quote: 'They delivered.', name: 'Alex', role: 'Founder' }];
  return (
    <SectionShell tone="atmosphere" wireframe={wireframe}>
      <OutlineText
        as="h2"
        className="mb-[var(--sb-space-8)] text-3xl font-semibold"
      >
        {props.heading}
      </OutlineText>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item, index) => (
          <ItemCard key={`${item.name}-${index}`} className="space-y-3">
            <p className="text-sm leading-relaxed">
              &ldquo;{item.quote}&rdquo;
            </p>
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-[var(--sb-ink-muted)]">{item.role}</p>
            </div>
          </ItemCard>
        ))}
      </div>
    </SectionShell>
  );
}

export const testimonialsConfig: ComponentConfig<TestimonialsProps> = {
  label: 'Testimonials',
  fields: {
    heading: text('Heading'),
    items: {
      type: 'array',
      label: 'Quotes',
      arrayFields: {
        quote: area('Quote'),
        name: text('Name'),
        role: text('Role'),
      },
      defaultItemProps: { quote: 'Great work', name: 'Name', role: 'Role' },
    },
  },
  defaultProps: {
    heading: 'What clients say',
    items: [
      {
        quote: 'Clear process and sharp delivery.',
        name: 'Alex',
        role: 'Founder',
      },
      {
        quote: 'Our site finally ranks and converts.',
        name: 'Sam',
        role: 'Marketing',
      },
      { quote: 'Best agency decision we made.', name: 'Jordan', role: 'Ops' },
    ],
  },
  render: Testimonials,
};

export type StatsBarProps = {
  items: Array<{ value: string; label: string }>;
};

export function StatsBar(props: StatsBarProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  const items = props.items?.length
    ? props.items
    : [
        { value: '120+', label: 'Projects' },
        { value: '98%', label: 'Retention' },
        { value: '4.9', label: 'Rating' },
      ];
  return (
    <SectionShell wireframe={wireframe} className="!py-[var(--sb-space-8)]">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="text-center">
            <p className="text-3xl font-semibold">{item.value}</p>
            <p className="text-xs tracking-wide text-[var(--sb-ink-muted)] uppercase">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export const statsBarConfig: ComponentConfig<StatsBarProps> = {
  label: 'Stats bar',
  fields: {
    items: {
      type: 'array',
      label: 'Stats',
      arrayFields: {
        value: text('Value'),
        label: text('Label'),
      },
      defaultItemProps: { value: '10+', label: 'Metric' },
    },
  },
  defaultProps: {
    items: [
      { value: '120+', label: 'Projects' },
      { value: '98%', label: 'Retention' },
      { value: '4.9', label: 'Rating' },
      { value: '12yr', label: 'Experience' },
    ],
  },
  render: StatsBar,
};

export type PricingTableProps = {
  heading: string;
  tiers: Array<{
    name: string;
    price: string;
    features: string;
    ctaLabel: string;
  }>;
};

export function PricingTable(props: PricingTableProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  const tiers = props.tiers?.length
    ? props.tiers
    : [
        {
          name: 'Starter',
          price: '£X',
          features: 'Feature A\nFeature B',
          ctaLabel: 'Choose',
        },
      ];
  return (
    <SectionShell wireframe={wireframe}>
      <OutlineText
        as="h2"
        className="mb-[var(--sb-space-8)] text-3xl font-semibold"
      >
        {props.heading}
      </OutlineText>
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((tier, index) => (
          <ItemCard key={`${tier.name}-${index}`} className="space-y-4">
            <div>
              <p className="font-medium">{tier.name}</p>
              <p className="mt-1 text-2xl font-semibold">{tier.price}</p>
            </div>
            <ul className="space-y-1 text-sm text-[var(--sb-ink-muted)]">
              {(tier.features || '')
                .split('\n')
                .filter(Boolean)
                .map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
            </ul>
            <CtaButton label={tier.ctaLabel} className="w-full" />
          </ItemCard>
        ))}
      </div>
    </SectionShell>
  );
}

export const pricingTableConfig: ComponentConfig<PricingTableProps> = {
  label: 'Pricing table',
  fields: {
    heading: text('Heading'),
    tiers: {
      type: 'array',
      label: 'Tiers',
      arrayFields: {
        name: text('Name'),
        price: text('Price'),
        features: area('Features (one per line)'),
        ctaLabel: text('CTA'),
      },
      defaultItemProps: {
        name: 'Plan',
        price: '£0',
        features: 'Feature',
        ctaLabel: 'Choose',
      },
    },
  },
  defaultProps: {
    heading: 'Pricing',
    tiers: [
      {
        name: 'Starter',
        price: '£899',
        features: '5 pages\nBasic SEO\n1 revision',
        ctaLabel: 'Get started',
      },
      {
        name: 'Growth',
        price: '£1,899',
        features: '12 pages\nLocal SEO\nCMS training',
        ctaLabel: 'Choose Growth',
      },
      {
        name: 'Custom',
        price: "Let's talk",
        features: 'Bespoke scope\nIntegrations\nOngoing retainer',
        ctaLabel: 'Book a call',
      },
    ],
  },
  render: PricingTable,
};

export type TeamGridProps = {
  heading: string;
  members: Array<{ name: string; role: string; bio: string }>;
};

export function TeamGrid(props: TeamGridProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  const members = props.members?.length
    ? props.members
    : [{ name: 'Person', role: 'Role', bio: 'Short bio.' }];
  return (
    <SectionShell wireframe={wireframe}>
      <OutlineText
        as="h2"
        className="mb-[var(--sb-space-8)] text-3xl font-semibold"
      >
        {props.heading}
      </OutlineText>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {members.map((member, index) => (
          <ItemCard key={`${member.name}-${index}`} className="space-y-3">
            <MediaPlaceholder aspect="square" label="Photo" />
            <p className="font-medium">{member.name}</p>
            <p className="text-xs text-[var(--sb-ink-muted)]">{member.role}</p>
            <p className="text-sm text-[var(--sb-ink-muted)]">{member.bio}</p>
          </ItemCard>
        ))}
      </div>
    </SectionShell>
  );
}

export const teamGridConfig: ComponentConfig<TeamGridProps> = {
  label: 'Team grid',
  fields: {
    heading: text('Heading'),
    members: {
      type: 'array',
      label: 'Members',
      arrayFields: {
        name: text('Name'),
        role: text('Role'),
        bio: area('Bio'),
      },
      defaultItemProps: { name: 'Name', role: 'Role', bio: 'Bio' },
    },
  },
  defaultProps: {
    heading: 'The team',
    members: [
      { name: 'Taylor', role: 'Strategy', bio: 'Leads discovery and IA.' },
      { name: 'Casey', role: 'Design', bio: 'Systems and brand.' },
      { name: 'Riley', role: 'Build', bio: 'Webflow / Astro / Next.' },
    ],
  },
  render: TeamGrid,
};

export type FAQAccordionProps = {
  heading: string;
  items: Array<{ question: string; answer: string }>;
};

export function FAQAccordion(props: FAQAccordionProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  const items = props.items?.length
    ? props.items
    : [{ question: 'Question?', answer: 'Answer.' }];
  return (
    <SectionShell wireframe={wireframe}>
      <OutlineText
        as="h2"
        className="mb-[var(--sb-space-8)] text-3xl font-semibold"
      >
        {props.heading}
      </OutlineText>
      <div className="space-y-3">
        {items.map((item, index) => (
          <ItemCard key={`${item.question}-${index}`} className="space-y-2">
            <p className="font-medium">{item.question}</p>
            <p className="text-sm text-[var(--sb-ink-muted)]">{item.answer}</p>
          </ItemCard>
        ))}
      </div>
    </SectionShell>
  );
}

export const faqAccordionConfig: ComponentConfig<FAQAccordionProps> = {
  label: 'FAQ accordion',
  fields: {
    heading: text('Heading'),
    items: {
      type: 'array',
      label: 'FAQs',
      arrayFields: {
        question: text('Question'),
        answer: area('Answer'),
      },
      defaultItemProps: { question: 'Question?', answer: 'Answer.' },
    },
  },
  defaultProps: {
    heading: 'FAQs',
    items: [
      {
        question: 'How long does a build take?',
        answer: 'Typical marketing sites ship in 3–6 weeks.',
      },
      {
        question: 'Do you handle SEO?',
        answer: 'Yes — technical SEO and answer-engine blocks are included.',
      },
    ],
  },
  render: FAQAccordion,
};

export type CTABandProps = {
  headline: string;
  subhead: string;
  ctaLabel: string;
};

export function CTABand(props: CTABandProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  return (
    <SectionShell tone="ink" wireframe={wireframe}>
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-2">
          <OutlineText as="h2" className="text-3xl font-semibold">
            {props.headline}
          </OutlineText>
          {props.subhead ? (
            <OutlineText className="text-sm opacity-80">
              {props.subhead}
            </OutlineText>
          ) : null}
        </div>
        <CtaButton
          label={props.ctaLabel}
          className="!bg-[var(--sb-surface)] !text-[var(--sb-ink)]"
        />
      </div>
    </SectionShell>
  );
}

export const ctaBandConfig: ComponentConfig<CTABandProps> = {
  label: 'CTA band',
  fields: {
    headline: text('Headline'),
    subhead: area('Subhead'),
    ctaLabel: text('CTA'),
  },
  defaultProps: {
    headline: 'Ready when you are',
    subhead: 'Book a short discovery call.',
    ctaLabel: 'Book a call',
  },
  render: CTABand,
};

export type ContactFormProps = {
  heading: string;
  body: string;
  address: string;
  phone: string;
  email: string;
  submitLabel: string;
};

export function ContactForm(props: ContactFormProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  return (
    <SectionShell wireframe={wireframe}>
      <div className="grid gap-[var(--sb-space-8)] md:grid-cols-2">
        <div className="space-y-3">
          <OutlineText as="h2" className="text-3xl font-semibold">
            {props.heading}
          </OutlineText>
          <OutlineText className="text-[var(--sb-ink-muted)]">
            {props.body}
          </OutlineText>
          <div className="space-y-1 text-sm text-[var(--sb-ink-muted)]">
            <p>{props.address}</p>
            <p>{props.phone}</p>
            <p>{props.email}</p>
          </div>
        </div>
        <ItemCard className="space-y-3">
          <div className="h-10 rounded-[var(--sb-radius-sm)] border border-[var(--sb-border)] bg-[var(--sb-canvas)]" />
          <div className="h-10 rounded-[var(--sb-radius-sm)] border border-[var(--sb-border)] bg-[var(--sb-canvas)]" />
          <div className="h-24 rounded-[var(--sb-radius-sm)] border border-[var(--sb-border)] bg-[var(--sb-canvas)]" />
          <CtaButton label={props.submitLabel} />
        </ItemCard>
      </div>
    </SectionShell>
  );
}

export const contactFormConfig: ComponentConfig<ContactFormProps> = {
  label: 'Contact form',
  fields: {
    heading: text('Heading'),
    body: area('Body'),
    address: text('Address'),
    phone: text('Phone'),
    email: text('Email'),
    submitLabel: text('Submit'),
  },
  defaultProps: {
    heading: 'Contact',
    body: 'Tell us about the project.',
    address: '123 High Street',
    phone: '+44 0000 000000',
    email: 'hello@example.com',
    submitLabel: 'Send message',
  },
  render: ContactForm,
};

export type MapSectionProps = {
  heading: string;
  address: string;
  hours: string;
  locations: string;
};

export function MapSection(props: MapSectionProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  return (
    <SectionShell wireframe={wireframe}>
      <div className="grid gap-[var(--sb-space-8)] md:grid-cols-2">
        <MediaPlaceholder aspect="landscape" label="Map" className="min-h-56" />
        <div className="space-y-3">
          <OutlineText as="h2" className="text-3xl font-semibold">
            {props.heading}
          </OutlineText>
          <p className="text-sm text-[var(--sb-ink-muted)]">{props.address}</p>
          <p className="text-sm text-[var(--sb-ink-muted)]">{props.hours}</p>
          <p className="text-sm whitespace-pre-line text-[var(--sb-ink-muted)]">
            {props.locations}
          </p>
        </div>
      </div>
    </SectionShell>
  );
}

export const mapSectionConfig: ComponentConfig<MapSectionProps> = {
  label: 'Map / locations',
  fields: {
    heading: text('Heading'),
    address: text('Address'),
    hours: text('Hours'),
    locations: area('Locations'),
  },
  defaultProps: {
    heading: 'Find us',
    address: '123 High Street',
    hours: 'Mon–Fri 9–5',
    locations: 'Service area: City + surrounds',
  },
  render: MapSection,
};

export type BlogGridProps = {
  heading: string;
  posts: Array<{ title: string; excerpt: string }>;
};

export function BlogGrid(props: BlogGridProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  const posts = props.posts?.length
    ? props.posts
    : [{ title: 'Post title', excerpt: 'Short excerpt.' }];
  return (
    <SectionShell wireframe={wireframe}>
      <OutlineText
        as="h2"
        className="mb-[var(--sb-space-8)] text-3xl font-semibold"
      >
        {props.heading}
      </OutlineText>
      <div className="grid gap-4 md:grid-cols-3">
        {posts.map((post, index) => (
          <ItemCard key={`${post.title}-${index}`} className="space-y-3">
            <MediaPlaceholder label="Cover" />
            <p className="font-medium">{post.title}</p>
            <p className="text-sm text-[var(--sb-ink-muted)]">{post.excerpt}</p>
          </ItemCard>
        ))}
      </div>
    </SectionShell>
  );
}

export const blogGridConfig: ComponentConfig<BlogGridProps> = {
  label: 'Blog grid',
  fields: {
    heading: text('Heading'),
    posts: {
      type: 'array',
      label: 'Posts',
      arrayFields: {
        title: text('Title'),
        excerpt: area('Excerpt'),
      },
      defaultItemProps: { title: 'Post', excerpt: 'Excerpt' },
    },
  },
  defaultProps: {
    heading: 'Latest writing',
    posts: [
      { title: 'Post one', excerpt: 'Short excerpt.' },
      { title: 'Post two', excerpt: 'Short excerpt.' },
      { title: 'Post three', excerpt: 'Short excerpt.' },
    ],
  },
  render: BlogGrid,
};

export type ContentProseProps = {
  heading: string;
  body: string;
};

export function ContentProse(props: ContentProseProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  return (
    <SectionShell wireframe={wireframe}>
      <div className="mx-auto max-w-3xl space-y-4">
        <OutlineText as="h2" className="text-3xl font-semibold">
          {props.heading}
        </OutlineText>
        <OutlineText className="leading-relaxed whitespace-pre-line text-[var(--sb-ink-muted)]">
          {props.body}
        </OutlineText>
      </div>
    </SectionShell>
  );
}

export const contentProseConfig: ComponentConfig<ContentProseProps> = {
  label: 'Content prose',
  fields: {
    heading: text('Heading'),
    body: area('Body'),
  },
  defaultProps: {
    heading: 'Section heading',
    body: 'Long-form copy lives here. Keep sentences concrete.',
  },
  render: ContentProse,
};

export type GalleryGridProps = {
  heading: string;
  captions: string;
};

export function GalleryGrid(props: GalleryGridProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  const captions = (props.captions || 'One, Two, Three, Four')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    <SectionShell wireframe={wireframe}>
      <OutlineText
        as="h2"
        className="mb-[var(--sb-space-8)] text-3xl font-semibold"
      >
        {props.heading}
      </OutlineText>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {captions.map((caption) => (
          <div key={caption} className="space-y-2">
            <MediaPlaceholder label={caption} aspect="square" />
            <p className="text-xs text-[var(--sb-ink-muted)]">{caption}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export const galleryGridConfig: ComponentConfig<GalleryGridProps> = {
  label: 'Gallery grid',
  fields: {
    heading: text('Heading'),
    captions: area('Captions (comma-separated)'),
  },
  defaultProps: {
    heading: 'Gallery',
    captions: 'Space one, Space two, Space three, Space four',
  },
  render: GalleryGrid,
};

export type FooterProps = {
  brandName: string;
  column1: string;
  column2: string;
  legal: string;
};

export function Footer(props: FooterProps & PuckMeta) {
  const wireframe = useWireframeMode(wireFrom(props));
  return (
    <SectionShell
      tone="atmosphere"
      wireframe={wireframe}
      className="border-t border-[var(--sb-border)] !py-[var(--sb-space-8)]"
    >
      <div className="grid gap-6 md:grid-cols-3">
        <p className="text-sm font-semibold">{props.brandName}</p>
        <p className="text-sm whitespace-pre-line text-[var(--sb-ink-muted)]">
          {props.column1}
        </p>
        <p className="text-sm whitespace-pre-line text-[var(--sb-ink-muted)]">
          {props.column2}
        </p>
      </div>
      <p className="mt-6 text-xs text-[var(--sb-ink-muted)]">{props.legal}</p>
    </SectionShell>
  );
}

export const footerConfig: ComponentConfig<FooterProps> = {
  label: 'Footer',
  fields: {
    brandName: text('Brand'),
    column1: area('Column 1'),
    column2: area('Column 2'),
    legal: text('Legal line'),
  },
  defaultProps: {
    brandName: 'Brand',
    column1: 'Services\nAbout\nContact',
    column2: 'Privacy\nTerms',
    legal: '© Brand. All rights reserved.',
  },
  render: Footer,
};
