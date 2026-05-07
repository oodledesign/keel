import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

type ModulePlaceholderPageProps = {
  title: string;
  description: string;
  links: Array<{
    href: string;
    label: string;
  }>;
};

export function ModulePlaceholderPage(props: ModulePlaceholderPageProps) {
  return (
    <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{props.title}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {props.description}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {props.links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-white/10 bg-black/10 p-4 text-sm transition hover:border-white/20 hover:bg-black/20"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </PageBody>
  );
}
