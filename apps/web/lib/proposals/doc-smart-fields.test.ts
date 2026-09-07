import { describe, expect, it } from 'vitest';

import {
  PROPOSAL_SMART_FIELD_PILLS,
  renderSmartFields,
} from '~/home/[account]/proposals/_lib/doc-smart-fields';

describe('proposal project name merge field', () => {
  it('exposes Project name in the insertable pills', () => {
    expect(
      PROPOSAL_SMART_FIELD_PILLS.some(
        (field) =>
          field.token === '{{project.name}}' && field.label === 'Project name',
      ),
    ).toBe(true);
  });

  it('renders the linked project name', () => {
    expect(
      renderSmartFields('Proposal for {{project.name}}', {
        projectName: 'Website refresh',
      }),
    ).toBe('Proposal for Website refresh');
  });

  it('resolves the snake_case alias', () => {
    expect(
      renderSmartFields('Project: {{project_name}}', {
        projectName: 'Brand refresh',
      }),
    ).toBe('Project: Brand refresh');
  });

  it('resolves to empty when the proposal is not linked to a project', () => {
    expect(
      renderSmartFields('Proposal for {{project.name}}.', {
        projectName: null,
      }),
    ).toBe('Proposal for .');
    expect(renderSmartFields('{{project.name}}{{project_name}}', {})).toBe('');
  });
});
