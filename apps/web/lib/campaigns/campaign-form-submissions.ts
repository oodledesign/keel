export type CampaignFormSubmissionRow = {
  id: string;
  contactName: string | null;
  contactEmail: string | null;
  createdAt: string;
};

export type CampaignLinkedFormSubmissions = {
  formId: string;
  formName: string;
  isRsvp: boolean;
  submissions: CampaignFormSubmissionRow[];
};
