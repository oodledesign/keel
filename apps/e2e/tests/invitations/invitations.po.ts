import { Page, expect } from '@playwright/test';

import { AuthPageObject } from '../authentication/auth.po';
import { TeamAccountsPageObject } from '../team-accounts/team-accounts.po';

export class InvitationsPageObject {
  private readonly page: Page;
  public auth: AuthPageObject;
  public teamAccounts: TeamAccountsPageObject;

  constructor(page: Page) {
    this.page = page;
    this.auth = new AuthPageObject(page);
    this.teamAccounts = new TeamAccountsPageObject(page);
  }

  setup() {
    return this.teamAccounts.setup();
  }

  public async inviteMembers(
    invites: Array<{
      email: string;
      role: string;
    }>,
  ) {
    const form = this.getInviteForm();

    for (let index = 0; index < invites.length; index++) {
      const invite = invites[index];

      if (!invite) {
        continue;
      }

      console.log(`Inviting ${invite.email} with role ${invite.role}...`);

      const nth = index + 1;

      await this.page.fill(
        `[data-test="invite-member-form-item"]:nth-child(${nth}) [data-test="invite-email-input"]`,
        invite.email,
      );

      await this.page.click(
        `[data-test="invite-member-form-item"]:nth-child(${nth}) [data-test="role-selector-trigger"]`,
      );

      await this.page.click(`[data-test="role-option-${invite.role}"]`);

      if (index < invites.length - 1) {
        await form.locator('[data-test="add-new-invite-button"]').click();
      }
    }

    await Promise.all([
      form.locator('button[type="submit"]').click(),
      this.page.waitForResponse((response) => {
        return (
          response.url().includes('/members') &&
          response.request().method() === 'POST'
        );
      }),
    ]);
  }

  navigateToMembers() {
    return expect(async () => {
      await this.page
        .locator('a', {
          hasText: 'Members',
        })
        .click();

      await this.page.waitForURL('**/home/*/members');
    }).toPass();
  }

  async openInviteForm() {
    await expect(async () => {
      await this.page.click('[data-test="invite-members-form-trigger"]');

      return await expect(this.getInviteForm()).toBeVisible();
    }).toPass();
  }

  getInvitations() {
    return this.page.locator('[data-test="invitation-email"]');
  }

  async deleteInvitation(email: string) {
    const actions = this.getInvitationRow(email).getByRole('button');

    await actions.click();

    await this.page.locator('[data-test="remove-invitation-trigger"]').click();

    await this.page.click(
      '[data-test="delete-invitation-form"] button[type="submit"]',
    );
  }

  getInvitationRow(email: string) {
    return this.page.getByRole('row', { name: email });
  }

  async updateInvitation(email: string, role: string) {
    const row = this.getInvitationRow(email);
    const actions = row.getByRole('button');

    await actions.click();

    await this.page.locator('[data-test="update-invitation-trigger"]').click();

    await this.page.click(`[data-test="role-selector-trigger"]`);
    await this.page.click(`[data-test="role-option-${role}"]`);

    await this.page.click(
      '[data-test="update-invitation-form"] button[type="submit"]',
    );
  }

  async acceptInvitation() {
    console.log('Accepting invitation...');

    const click = this.page
      .locator('[data-test="join-team-form"] button[type="submit"]')
      .click();

    const response = this.page.waitForResponse((response) => {
      return (
        response.url().includes('/join') &&
        response.request().method() === 'POST'
      );
    });

    await Promise.all([click, response]);

    // wait for animation to complete
    await this.page.waitForTimeout(500);

    // skip authentication setup
    const continueButton = this.page.locator('[data-test="continue-button"]');

    if (
      await continueButton.isVisible({
        timeout: 1000,
      })
    ) {
      await continueButton.click();

      // Handle confirmation dialog that appears when skipping without adding auth
      const confirmationDialog = this.page.locator(
        '[data-test="no-auth-method-dialog"]',
      );

      if (
        await confirmationDialog.isVisible({
          timeout: 2000,
        })
      ) {
        console.log('Confirmation dialog appeared, clicking Continue...');
        await this.page
          .locator('[data-test="no-auth-dialog-continue"]')
          .click();
      }
    }

    // wait for redirect to account home
    await this.page.waitForURL(new RegExp('/home/[a-z0-9-]+'));
  }

  private getInviteForm() {
    return this.page.locator('[data-test="invite-members-form"]');
  }
}
