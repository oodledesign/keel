import { ExternalLink } from 'lucide-react';

const LINKEDIN_DATA_EXPORT_URL =
  'https://www.linkedin.com/mypreferences/d/download-my-data';

export function LinkedInExportInstructions({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 p-4 text-sm text-[var(--workspace-shell-text-muted)]">
      <p className="font-medium text-[var(--workspace-shell-text)]">
        How to download Connections.csv from LinkedIn
      </p>

      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          Open LinkedIn on <strong>desktop</strong> (the export is not available
          on mobile) and sign in.
        </li>
        <li>
          Click your profile photo (<strong>Me</strong>) at the top, then choose{' '}
          <strong>Settings &amp; Privacy</strong>.
        </li>
        <li>
          In the left sidebar, open <strong>Data privacy</strong>, then click{' '}
          <strong>Get a copy of your data</strong>.
        </li>
        <li>
          Choose <strong>Want something in particular?</strong>, tick{' '}
          <strong>Connections</strong>, then click <strong>Request archive</strong>.
          Confirm with your password if asked.
        </li>
        <li>
          LinkedIn emails you when the file is ready — usually within{' '}
          <strong>10–20 minutes</strong>, sometimes up to 24 hours. Check spam
          if it does not arrive.
        </li>
        <li>
          Download the archive from the email or from LinkedIn&apos;s data page,
          unzip it, and upload <strong>Connections.csv</strong> here.
        </li>
      </ol>

      {!compact ? (
        <>
          <p className="mt-4 text-xs leading-relaxed">
            The file includes first name, last name, company, job title, and
            connection date for your <strong>1st-degree connections</strong>.
            Email addresses are only included when a connection has chosen to
            share them — many rows will not have an email.
          </p>

          <a
            href={LINKEDIN_DATA_EXPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ozer-accent)] hover:underline"
          >
            Open LinkedIn data export page
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </>
      ) : null}
    </div>
  );
}
