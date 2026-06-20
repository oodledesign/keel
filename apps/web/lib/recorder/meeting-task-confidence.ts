export const HIGH_CONFIDENCE_ASSIGNEE_THRESHOLD = 0.75;
export const LOW_CONFIDENCE_ASSIGNEE_THRESHOLD = 0.6;

export function isHighConfidenceMeetingSuggestion(item: {
  assigneeConfidence: number | null;
  suggestedAssigneeId: string | null;
}): boolean {
  return (
    item.suggestedAssigneeId !== null &&
    item.assigneeConfidence !== null &&
    item.assigneeConfidence >= HIGH_CONFIDENCE_ASSIGNEE_THRESHOLD
  );
}
