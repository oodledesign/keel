import 'server-only';

import Link from 'next/link';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

async function LegalMarkdown({ filename }: { filename: string }) {
  const filePath = path.join(process.cwd(), 'public', 'legal', filename);
  const markdown = await readFile(filePath, 'utf8');
  const content = markdown.replace(/^# .+\n+/, '');

  return (
    <div className="markdoc legal-doc max-w-3xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, node: _node, ...props }) {
            const className =
              'text-primary font-medium underline-offset-4 hover:underline';

            if (href?.startsWith('/')) {
              return (
                <Link href={href} className={className}>
                  {children}
                </Link>
              );
            }

            return (
              <a href={href} className={className} {...props}>
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="my-6 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium">
                  {children}
                </table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export async function PrivacyPolicyContent() {
  return <LegalMarkdown filename="privacy-policy.md" />;
}

export async function TermsOfServiceContent() {
  return <LegalMarkdown filename="terms-of-service.md" />;
}

export async function CookiePolicyContent() {
  return <LegalMarkdown filename="cookie-policy.md" />;
}

export async function DpaContent() {
  return <LegalMarkdown filename="ozer-dpa.md" />;
}
