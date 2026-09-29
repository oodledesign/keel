/**
 * Shared marketing site classes — Ozer tokens + crisp interaction defaults.
 * See DESIGN_SYSTEM.md and apps/web/styles/marketing.css
 *
 * Radius hierarchy: controls (buttons, inputs) 6px, media frames 10px,
 * everything else square and divided by hairline rules.
 */

const easeOut = 'ease-[cubic-bezier(0.23,1,0.32,1)]';

export const marketingShellClass = 'marketing-shell';

export const marketingHeader = 'marketing-header';

export const marketingFeatureCard = 'marketing-feature-card';

export const marketingSectionMuted = 'marketing-section-muted';

export const marketingRule = 'marketing-rule';

export const marketingRuleOnDark = 'marketing-rule-on-dark';

export const marketingRadiusControl = 'rounded-[var(--ozer-radius-control)]';

export const marketingRadiusMedia = 'rounded-[var(--ozer-radius-media)]';

export const marketingBtnPress = `transition-[transform,background-color,color,opacity,border-color] duration-[160ms] ${easeOut} active:scale-[0.97]`;

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:ring-offset-2';

export const marketingBtnPrimary = `inline-flex h-11 items-center justify-center gap-2 ${marketingRadiusControl} bg-[var(--ozer-accent)] px-5 text-[0.9375rem] font-medium text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-coral-600)] hover:text-[var(--ozer-cream-50)] ${focusRing} focus-visible:ring-offset-[var(--ozer-cream-50)] dark:focus-visible:ring-offset-[var(--ozer-plum-900)] ${marketingBtnPress}`;

/** Alias kept for existing call sites. */
export const marketingBtnGradient = marketingBtnPrimary;

export const marketingBtnOutline = `inline-flex h-11 items-center justify-center gap-2 ${marketingRadiusControl} border border-[color:var(--workspace-shell-border)] bg-transparent px-5 text-[0.9375rem] font-medium text-[var(--workspace-shell-text)] hover:border-[color:var(--workspace-shell-text)] hover:bg-transparent ${focusRing} focus-visible:ring-offset-[var(--ozer-cream-50)] dark:focus-visible:ring-offset-[var(--ozer-plum-900)] ${marketingBtnPress}`;

/** Outline CTA on fixed plum bands (commercial hero, etc.). */
export const marketingBtnOutlineOnDark = `inline-flex h-11 items-center justify-center gap-2 ${marketingRadiusControl} border border-[color:var(--ozer-on-dark-alpha-65)] bg-transparent px-5 text-[0.9375rem] font-medium text-[var(--ozer-text-on-dark)] hover:border-[color:var(--ozer-text-on-dark)] hover:bg-transparent ${focusRing} focus-visible:ring-offset-[var(--ozer-plum-950)] ${marketingBtnPress}`;

/** Secondary action as an underlined text link. */
export const marketingTextLink = `inline-flex items-center gap-1.5 text-[0.9375rem] font-medium underline decoration-[color:var(--ozer-plum-alpha-18)] decoration-1 underline-offset-[6px] transition-[text-decoration-color] duration-200 hover:decoration-current dark:decoration-[color:var(--ozer-on-dark-alpha-65)] ${focusRing} rounded-[2px]`;

export const marketingTextLinkOnDark = `inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-[var(--ozer-text-on-dark)] underline decoration-[color:var(--ozer-on-dark-alpha-65)] decoration-1 underline-offset-[6px] transition-[text-decoration-color] duration-200 hover:decoration-current ${focusRing} focus-visible:ring-offset-[var(--ozer-plum-950)] rounded-[2px]`;

/**
 * Small label above a heading: plain General Sans with a short leading rule.
 * For numbered sections use the MarketingSectionIndex component instead.
 */
export const marketingEyebrow =
  'inline-flex w-fit max-w-full items-center gap-3 self-start text-[0.8125rem] font-medium text-[var(--ozer-text-on-light-muted)] before:h-px before:w-6 before:shrink-0 before:bg-current dark:text-[var(--ozer-text-on-dark-muted)]';

/** H1 display — serif on marketing pages via --ozer-font-editorial. */
export const marketingDisplay =
  'font-heading text-[3rem] leading-[0.98] font-medium tracking-[-0.025em] text-balance sm:text-[4.25rem] lg:text-[5.5rem]';

/** Section H2 — serif, ~3rem on desktop. */
export const marketingSectionHeading =
  'font-heading text-[2.25rem] leading-[1.04] font-medium tracking-[-0.02em] text-balance md:text-[3rem]';

export const marketingLede =
  'max-w-[38rem] text-[1.0625rem] leading-[1.6] md:text-[1.1875rem]';

/** Prices and stats set as display type. */
export const marketingFigure =
  'font-heading font-medium tabular-nums tracking-[-0.03em]';

export const marketingCard = `${marketingRadiusMedia} border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]`;

export const marketingCardHover =
  'transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-[color:var(--workspace-shell-text-muted)]';

export const marketingPanelDeep = `${marketingRadiusMedia} border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]`;

export const marketingPanelInner =
  'rounded-[6px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)]';

export const marketingIconAccent = 'text-[var(--ozer-accent)]';

export const marketingFeaturedPlan =
  'border-[var(--workspace-shell-text)] bg-[var(--workspace-shell-panel)]';

export const marketingPlanBadge =
  'rounded-[4px] bg-[var(--ozer-accent)] px-2 py-0.5 text-xs font-semibold text-[var(--ozer-plum-950)]';

export const marketingMutedText = 'text-[var(--workspace-shell-text-muted)]';

export const marketingBodyText = 'text-[var(--workspace-shell-text-muted)]';

/** Plain text nav, no container. */
export const marketingNavPill = 'gap-x-6 xl:gap-x-7';

const navLinkBase =
  'inline-flex w-max items-center py-1.5 text-sm font-medium underline-offset-[10px] decoration-2 transition-colors duration-200 text-[var(--workspace-shell-nav-text)] hover:text-[var(--workspace-shell-nav-text-hover)]';

export const marketingNavLink = `${navLinkBase} hover:underline hover:decoration-[color:var(--ozer-plum-alpha-18)] dark:hover:decoration-[color:var(--ozer-on-dark-alpha-65)]`;

export const marketingNavLinkActive =
  'text-[var(--ozer-plum-950)] underline decoration-[var(--ozer-accent)] hover:text-[var(--ozer-plum-950)] hover:decoration-[var(--ozer-accent)] dark:text-[var(--ozer-text-on-dark)] dark:hover:text-[var(--ozer-text-on-dark)] dark:hover:decoration-[var(--ozer-accent)]';

export const marketingNavTrigger = `${navLinkBase} h-auto rounded-none bg-transparent px-0 hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-[var(--ozer-plum-950)] data-[state=open]:underline data-[state=open]:decoration-[var(--ozer-accent)] dark:data-[state=open]:text-[var(--ozer-text-on-dark)]`;

export const marketingNavDropdownTitle =
  'block text-sm font-medium text-[var(--workspace-shell-text)]';

export const marketingNavDropdownDesc =
  'mt-0.5 block text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]';

export const marketingNavDropdownItem =
  'flex items-start gap-3 rounded-[6px] px-3 py-2.5 transition hover:bg-[var(--workspace-shell-sidebar-accent)]';

export const marketingNavPanel =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/98 text-[var(--workspace-shell-text)]';

/** Fixed plum sections (hero bands, pricing) — always use on-dark text */
export const marketingSectionDark =
  'bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]';

export const marketingSectionDarkMuted =
  'text-[var(--ozer-text-on-dark-muted)]';

/** Strong ease-out curve for hero entrance (matches marketingBtnPress) */
export const marketingHeroEase = [0.23, 1, 0.32, 1] as const;
