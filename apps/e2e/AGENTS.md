# End-to-End Testing

## Skills

For E2E test implementation:
- `/playwright-e2e` - Test patterns and Page Objects

## Running Tests

```bash
# Single file (preferred)
pnpm --filter web-e2e exec playwright test <name> --workers=1

# All tests
pnpm test
```

## Page Object Pattern (Required)

```typescript
export class AuthPageObject {
  constructor(private readonly page: Page) {}

  async signIn(params: { email: string; password: string }) {
    await this.page.fill('input[name="email"]', params.email);
    await this.page.fill('input[name="password"]', params.password);
    await this.page.click('button[type="submit"]');
  }
}
```

## Selectors

Always use `data-test` attributes:

```typescript
await this.page.click('[data-test="submit-button"]');
await this.page.getByTestId('submit-button').click();
```

## Reliability with `toPass()`

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
tests/
├── authentication/
├── billing/
├── *.po.ts          # Page Objects
└── utils/
```
