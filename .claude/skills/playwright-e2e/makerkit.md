# Makerkit E2E Testing Patterns

## Page Objects Location

`apps/e2e/tests/*.po.ts`

## Auth Page Object

```typescript
export class AuthPageObject {
  constructor(private readonly page: Page) {}

  static MFA_KEY = 'test-mfa-key';

  async signIn(params: { email: string; password: string }) {
    await this.page.fill('input[name="email"]', params.email);
    await this.page.fill('input[name="password"]', params.password);
    await this.page.click('button[type="submit"]');
  }

  async signOut() {
    await this.page.click('[data-test="account-dropdown-trigger"]');
    await this.page.click('[data-test="account-dropdown-sign-out"]');
  }

  async bootstrapUser(params: { email: string; password: string; name: string }) {
    // Creates user via API
    await fetch('/api/test/create-user', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async loginAsUser(params: { email: string; password: string }) {
    await this.page.goto('/auth/sign-in');
    await this.signIn(params);
    await this.page.waitForURL('**/home/**');
  }

  createRandomEmail() {
    const value = Math.random() * 10000000000000;
    return `${value.toFixed(0)}@makerkit.dev`;
  }
}
```

## Common Selectors

```typescript
// Account dropdown
'[data-test="account-dropdown-trigger"]'
'[data-test="account-dropdown-sign-out"]'

// Navigation
'[data-test="sidebar-menu"]'
'[data-test="mobile-menu-trigger"]'

// Forms
'[data-test="submit-button"]'
'[data-test="cancel-button"]'

// Modals
'[data-test="dialog-confirm"]'
'[data-test="dialog-cancel"]'
```

## Test Setup Pattern

```typescript
// tests/auth.setup.ts
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  const auth = new AuthPageObject(page);

  await auth.bootstrapUser({
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
  });

  await auth.loginAsUser({
    email: 'test@example.com',
    password: 'password123',
  });

  // Save authentication state
  await page.context().storageState({ path: '.auth/user.json' });
});
```

## Reliability Patterns

### OTP/Email Operations

```typescript
await expect(async () => {
  const otpCode = await this.getOtpCodeFromEmail(email);
  expect(otpCode).not.toBeNull();
  await this.enterOtpCode(otpCode);
}).toPass();
```

### MFA Verification

```typescript
await expect(async () => {
  await auth.submitMFAVerification(AuthPageObject.MFA_KEY);
}).toPass({
  intervals: [500, 2500, 5000, 7500, 10_000, 15_000, 20_000]
});
```

### Network Requests

```typescript
await expect(async () => {
  const response = await this.page.waitForResponse(
    resp => resp.url().includes('auth/v1/user')
  );
  expect(response.status()).toBe(200);
}).toPass();
```

## Test Organization

```
apps/e2e/
├── playwright.config.ts
├── tests/
│   ├── auth.setup.ts
│   ├── authentication/
│   │   ├── sign-in.spec.ts
│   │   └── sign-up.spec.ts
│   ├── billing/
│   │   └── subscription.spec.ts
│   ├── teams/
│   │   └── invitations.spec.ts
│   └── utils/
│       └── auth.po.ts
└── .auth/
    └── user.json
```

## Running Tests

```bash
# Single file
pnpm --filter web-e2e exec playwright test authentication --workers=1

# With UI
pnpm --filter web-e2e exec playwright test --ui

# Debug mode
pnpm --filter web-e2e exec playwright test --debug
```
