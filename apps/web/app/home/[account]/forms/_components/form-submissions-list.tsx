'use client';

import Link from 'next/link';

import { Badge } from '@kit/ui/badge';

import pathsConfig from '~/config/paths.config';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { WorkspaceFormSubmissionRecord } from '../_lib/server/workspace-forms.service';

type Props = {
  accountSlug: string;
  submissions: WorkspaceFormSubmissionRecord[];
  destination?: string;
};

function recordHref(
  accountSlug: string,
  submission: WorkspaceFormSubmissionRecord,
) {
  if (submission.commercialEnquiryId && submission.listingId) {
    return `${pathsConfig.app.accountListingDetail
      .replace('[account]', accountSlug)
      .replace('[id]', submission.listingId)}/interest`;
  }

  if (submission.clientId) {
    return pathsConfig.app.accountClientDetail
      .replace('[account]', accountSlug)
      .replace('[clientId]', submission.clientId);
  }

  if (submission.requirementId) {
    return pathsConfig.app.accountRequirements.replace(
      '[account]',
      accountSlug,
    );
  }

  if (submission.pipelineDealId) {
    return pathsConfig.app.accountPipeline.replace('[account]', accountSlug);
  }

  return null;
}

export function FormSubmissionsList({
  accountSlug,
  submissions,
  destination,
}: Props) {
  const submissionsOnly = destination === 'submission_list';

  return (
    <section className={`${workspacePanelCard} p-5`}>
      <h2 className={`text-base font-semibold ${workspaceText}`}>
        Submissions
      </h2>
      <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
        {submissionsOnly
          ? 'Responses are stored here only — no pipeline, mailing list, or listing enquiry is created.'
          : 'Open the contact, mailing-list, pipeline, or listing record created from each submission.'}
      </p>

      {submissions.length === 0 ? (
        <p className={`mt-6 text-sm ${workspaceTextMuted}`}>
          {submissionsOnly
            ? 'No submissions yet. Publish the form and share the link to start collecting RSVPs or responses.'
            : 'No submissions yet. Publish the form and send the public link to collect the first one.'}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className={workspaceTextMuted}>
                <th className="pb-2 font-medium">Contact</th>
                <th className="pb-2 font-medium">Received</th>
                <th className="pb-2 font-medium">Record</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => {
                const href = recordHref(accountSlug, submission);
                const label = submission.commercialEnquiryId
                  ? 'Listing enquiry'
                  : submission.clientId
                    ? 'Mailing-list contact'
                    : submission.requirementId
                      ? 'Requirement'
                      : submission.pipelineDealId
                        ? 'Pipeline enquiry'
                        : submissionsOnly
                          ? 'Submission'
                          : 'Stored only';

                return (
                  <tr
                    key={submission.id}
                    className="border-t border-[color:var(--workspace-shell-border)]"
                  >
                    <td className={`py-3 ${workspaceText}`}>
                      <div>{submission.contactName || '—'}</div>
                      <div className={workspaceTextMuted}>
                        {submission.contactEmail ||
                          submission.contactPhone ||
                          ''}
                      </div>
                    </td>
                    <td className={`py-3 ${workspaceTextMuted}`}>
                      {new Date(submission.createdAt).toLocaleString('en-GB')}
                    </td>
                    <td className="py-3">
                      {href ? (
                        <Link
                          href={href}
                          className="text-[var(--workspace-shell-accent-text)] underline-offset-4 hover:underline"
                        >
                          {label}
                        </Link>
                      ) : (
                        <Badge variant="secondary">{label}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
