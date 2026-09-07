export function buildRecorderTriageSummary(input: {
  replyNow: number;
  replyLater: number;
  suggestedTasks: number;
  meetingReview: number;
}): string {
  const parts: string[] = [];
  const actionEmails = input.replyNow + input.replyLater;

  if (actionEmails > 0) {
    parts.push(
      actionEmails === 1
        ? '1 email needs a reply'
        : `${actionEmails} emails need a reply`,
    );
  }

  if (input.suggestedTasks > 0) {
    parts.push(
      input.suggestedTasks === 1
        ? '1 suggested task'
        : `${input.suggestedTasks} suggested tasks`,
    );
  }

  if (input.meetingReview > 0) {
    parts.push(
      input.meetingReview === 1
        ? '1 meeting task to review'
        : `${input.meetingReview} meeting tasks to review`,
    );
  }

  return parts.length > 0 ? parts.join(' · ') : 'Caught up';
}

export const RECORDER_TODAY_TRIAGE_UNAVAILABLE_REASON =
  'Email triage is user-scoped (google_connections + email_threads) and is readable with the recorder admin client + user_id. Null means no connected mailbox and no suggested/meeting-review items, or those tables were unavailable.';
