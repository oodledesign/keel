/**
 * Convert pathsConfig `/app/...` billing paths to in-app `/home/...` hrefs.
 */
export function toHomeBillingHref(appPath: string, accountSlug?: string) {
  const withAccount = accountSlug
    ? appPath.replace('[account]', accountSlug)
    : appPath;
  return withAccount.startsWith('/app')
    ? withAccount.replace(/^\/app/, '/home')
    : withAccount;
}
