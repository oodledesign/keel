import { Page } from '@playwright/test';

import { BillingPageObject } from '../utils/billing.po';

export class UserBillingPageObject {
  public readonly billing: BillingPageObject;

  constructor(private readonly page: Page) {
    this.billing = new BillingPageObject(page);
  }
}
