export type PricingTone = 'light' | 'dark';

export type PricingTheme = {
  section: string;
  sectionGlow: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  text: string;
  muted: string;
  card: string;
  cardSelected: string;
  cardUnselected: string;
  panel: string;
  panelInner: string;
  toggleTrack: string;
  togglePill: string;
  toggleText: string;
  toggleTextInactive: string;
  tierPanel: string;
  addonsPanel: string;
  tooltip: string;
  lineLabel: string;
  faqTone: 'light' | 'dark';
};

export function getPricingTheme(tone: PricingTone): PricingTheme {
  if (tone === 'light') {
    return {
      section:
        'relative overflow-hidden bg-[var(--workspace-shell-canvas)] pb-16 pt-4 text-[var(--workspace-shell-text)] md:pb-24 md:pt-6',
      sectionGlow: 'hidden',
      eyebrow:
        'text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-shell-text-muted)]',
      title:
        'mt-3 font-heading text-3xl font-semibold tracking-tight text-[var(--workspace-shell-text)] md:text-5xl',
      subtitle:
        'mt-4 text-base leading-relaxed text-[var(--workspace-shell-text-muted)] md:text-lg',
      text: 'text-[var(--workspace-shell-text)]',
      muted: 'text-[var(--workspace-shell-text-muted)]',
      card: 'bg-[var(--workspace-shell-panel)]',
      cardSelected:
        'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)] shadow-[0_0_0_1px_var(--ozer-coral-alpha-45)]',
      cardUnselected:
        'border-[color:var(--workspace-shell-border)] hover:border-[var(--ozer-accent)]/25',
      panel:
        'rounded-3xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 lg:sticky lg:top-24',
      panelInner:
        'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)]',
      toggleTrack:
        'inline-flex items-center gap-2 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1',
      togglePill: 'bg-[var(--workspace-shell-sidebar-accent)]',
      toggleText: 'text-[var(--workspace-shell-text)]',
      toggleTextInactive:
        'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
      tierPanel:
        'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 sm:p-5',
      addonsPanel:
        'space-y-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 sm:p-5',
      tooltip:
        'max-w-[200px] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]',
      lineLabel: 'text-[var(--workspace-shell-text-muted)]',
      faqTone: 'light',
    };
  }

  return {
    section:
      'relative overflow-hidden bg-[var(--ozer-plum-900)] pb-24 pt-20 text-[var(--ozer-text-on-dark)] md:pb-32',
    sectionGlow: 'hidden',
    eyebrow:
      'text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ozer-text-on-dark-muted)]',
    title:
      'mt-3 font-heading text-3xl font-semibold tracking-tight text-[var(--ozer-text-on-dark)] md:text-5xl',
    subtitle:
      'mt-4 text-base leading-relaxed text-[var(--ozer-text-on-dark-muted)] md:text-lg',
    text: 'text-[var(--ozer-text-on-dark)]',
    muted: 'text-[var(--ozer-text-on-dark-muted)]',
    card: 'bg-[var(--ozer-plum-950)]',
    cardSelected:
      'border-[var(--ozer-accent)] bg-[var(--ozer-plum-800)] shadow-[0_0_0_1px_var(--ozer-coral-alpha-45)]',
    cardUnselected:
      'border-[color:var(--ozer-border-on-dark)] hover:border-[var(--ozer-accent)]/40',
    panel:
      'rounded-3xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] p-6 lg:sticky lg:top-24',
    panelInner:
      'rounded-2xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)]',
    toggleTrack:
      'inline-flex items-center gap-2 rounded-full border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] p-1',
    togglePill: 'bg-[var(--ozer-plum-800)]',
    toggleText: 'text-[var(--ozer-text-on-dark)]',
    toggleTextInactive:
      'text-[var(--ozer-text-on-dark-muted)] hover:text-[var(--ozer-text-on-dark)]',
    tierPanel:
      'rounded-2xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] p-4 sm:p-5',
    addonsPanel:
      'space-y-6 rounded-2xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] p-4 sm:p-5',
    tooltip:
      'max-w-[200px] border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]',
    lineLabel: 'text-[var(--ozer-text-on-dark-muted)]',
    faqTone: 'dark',
  };
}
