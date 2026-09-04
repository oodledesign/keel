import {
  type WorkspaceFormDestination,
  type WorkspaceFormField,
  defaultWorkspaceFormFields,
} from './form-fields';

export const WORKSPACE_FORM_TEMPLATES = ['contact', 'blank', 'rsvp'] as const;

export type WorkspaceFormTemplate = (typeof WORKSPACE_FORM_TEMPLATES)[number];

export type WorkspaceFormTemplateMeta = {
  id: WorkspaceFormTemplate;
  label: string;
  description: string;
  defaultName: string;
  suggestedDestination: WorkspaceFormDestination;
  submitLabel: string;
  successMessage: string;
};

export const WORKSPACE_FORM_TEMPLATE_META: Record<
  WorkspaceFormTemplate,
  WorkspaceFormTemplateMeta
> = {
  contact: {
    id: 'contact',
    label: 'Contact',
    description: 'Name, email, phone, and a message.',
    defaultName: 'Contact form',
    suggestedDestination: 'pipeline',
    submitLabel: 'Submit',
    successMessage: 'Thanks — we received your message.',
  },
  blank: {
    id: 'blank',
    label: 'Blank',
    description: 'Start with name and email, then add your own fields.',
    defaultName: 'Custom form',
    suggestedDestination: 'pipeline',
    submitLabel: 'Submit',
    successMessage: 'Thanks — we received your response.',
  },
  rsvp: {
    id: 'rsvp',
    label: 'RSVP',
    description: 'Attendance, guests, and dietary needs for events.',
    defaultName: 'Event RSVP',
    suggestedDestination: 'submission_list',
    submitLabel: 'Send RSVP',
    successMessage: 'Thanks — your RSVP has been received.',
  },
};

export function listWorkspaceFormTemplates(): WorkspaceFormTemplateMeta[] {
  return WORKSPACE_FORM_TEMPLATES.map((id) => WORKSPACE_FORM_TEMPLATE_META[id]);
}

function blankWorkspaceFormFields(): WorkspaceFormField[] {
  return [
    {
      id: 'name',
      type: 'name',
      key: 'name',
      label: 'Name',
      required: true,
      placeholder: 'Your name',
    },
    {
      id: 'email',
      type: 'email',
      key: 'email',
      label: 'Email',
      required: true,
      placeholder: 'you@example.com',
    },
  ];
}

function rsvpWorkspaceFormFields(): WorkspaceFormField[] {
  return [
    {
      id: 'name',
      type: 'name',
      key: 'name',
      label: 'Name',
      required: true,
      placeholder: 'Your name',
    },
    {
      id: 'email',
      type: 'email',
      key: 'email',
      label: 'Email',
      required: true,
      placeholder: 'you@example.com',
    },
    {
      id: 'attendance',
      type: 'select',
      key: 'attendance',
      label: 'Will you attend?',
      required: true,
      options: ['Yes', 'No', 'Maybe'],
    },
    {
      id: 'guests',
      type: 'text',
      key: 'guests',
      label: 'Number of guests',
      required: false,
      placeholder: 'Optional',
    },
    {
      id: 'dietary',
      type: 'textarea',
      key: 'dietary',
      label: 'Dietary requirements',
      required: false,
      placeholder: 'Optional',
    },
    {
      id: 'message',
      type: 'message',
      key: 'message',
      label: 'Comments',
      required: false,
      placeholder: 'Anything else we should know?',
    },
  ];
}

export function workspaceFormFieldsForTemplate(
  template: WorkspaceFormTemplate = 'contact',
): WorkspaceFormField[] {
  switch (template) {
    case 'blank':
      return blankWorkspaceFormFields();
    case 'rsvp':
      return rsvpWorkspaceFormFields();
    case 'contact':
    default:
      return defaultWorkspaceFormFields();
  }
}

export function workspaceFormCreateDefaultsForTemplate(
  template: WorkspaceFormTemplate = 'contact',
): {
  fields: WorkspaceFormField[];
  submitLabel: string;
  successMessage: string;
  defaultName: string;
  suggestedDestination: WorkspaceFormDestination;
} {
  const meta = WORKSPACE_FORM_TEMPLATE_META[template];
  return {
    fields: workspaceFormFieldsForTemplate(template),
    submitLabel: meta.submitLabel,
    successMessage: meta.successMessage,
    defaultName: meta.defaultName,
    suggestedDestination: meta.suggestedDestination,
  };
}
