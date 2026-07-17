export type YbbNavLink = {
  label?: string;
  href?: string;
  hasDropdown?: boolean;
};

export const YBB_DEFAULT_NAV_LINKS: YbbNavLink[] = [
  { label: 'About us', href: '#about' },
  { label: 'Your wedding', href: '#services', hasDropdown: true },
  { label: 'Investment', href: '#faq', hasDropdown: true },
  { label: 'Portfolio', href: '#portfolio' },
  { label: 'Kind words', href: '#testimonials' },
  { label: 'Blog', href: '#blog' },
];
