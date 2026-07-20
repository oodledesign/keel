import { cn } from '../../lib/utils';

interface FooterSection {
  heading: React.ReactNode;
  links: Array<{
    href: string;
    label: React.ReactNode;
  }>;
}

interface FooterSocialLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Open in a new tab (http/https). Omit for mailto: and same-tab links. */
  external?: boolean;
}

interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  logo: React.ReactNode;
  description: React.ReactNode;
  copyright: React.ReactNode;
  sections: FooterSection[];
  socialLinks?: FooterSocialLink[];
  newsletter?: React.ReactNode;
  legalLinks?: Array<{ href: string; label: React.ReactNode }>;
}

export const Footer: React.FC<FooterProps> = ({
  className,
  logo,
  description,
  copyright,
  sections,
  socialLinks,
  newsletter,
  legalLinks,
  ...props
}) => {
  return (
    <footer
      className={cn(
        'site-footer relative mt-auto w-full border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] py-12 xl:py-16',
        className,
      )}
      {...props}
    >
      <div className="container">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_minmax(0,1.1fr)] lg:gap-12">
          <div className="flex flex-col gap-y-5">
            <div>{logo}</div>
            <div className="text-muted-foreground max-w-sm text-sm leading-relaxed [&>p]:mt-0 [&>p:not(:first-child)]:mt-2">
              {description}
            </div>
            {socialLinks && socialLinks.length > 0 ? (
              <ul className="flex flex-wrap items-center gap-2.5">
                {socialLinks.map((item) => {
                  const external =
                    item.external ?? /^https?:\/\//i.test(item.href);
                  return (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        {...(external
                          ? {
                              target: '_blank' as const,
                              rel: 'noopener noreferrer',
                            }
                          : {})}
                        aria-label={item.label}
                        className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] transition-colors"
                      >
                        {item.icon}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
            {sections.map((section, index) => (
              <div key={index}>
                <FooterSectionHeading>{section.heading}</FooterSectionHeading>
                <FooterSectionList>
                  {section.links.map((link, linkIndex) => (
                    <FooterLink key={linkIndex} href={link.href}>
                      {link.label}
                    </FooterLink>
                  ))}
                </FooterSectionList>
              </div>
            ))}
          </div>

          {newsletter ? <div className="min-w-0">{newsletter}</div> : null}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[color:var(--workspace-shell-border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground text-xs">{copyright}</div>
          {legalLinks && legalLinks.length > 0 ? (
            <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-xs">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="hover:text-foreground transition-colors hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
};

function FooterSectionHeading(props: React.PropsWithChildren) {
  return (
    <span className="font-heading text-secondary-foreground/90 text-sm font-semibold">
      {props.children}
    </span>
  );
}

function FooterSectionList(props: React.PropsWithChildren) {
  return <ul className="mt-3 flex flex-col gap-y-2">{props.children}</ul>;
}

function FooterLink({
  href,
  children,
}: React.PropsWithChildren<{ href: string }>) {
  return (
    <li className="text-muted-foreground text-sm hover:underline [&>a]:transition-colors">
      <a href={href}>{children}</a>
    </li>
  );
}
