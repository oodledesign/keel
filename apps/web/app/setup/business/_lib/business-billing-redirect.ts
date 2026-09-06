import pathsConfig from '~/config/paths.config';

function slugPath(template: string, slug: string) {
  return template.replace('[account]', slug);
}

export function businessPaidPlanBillingPath(
  slug: string,
  productId: string,
  seats: number,
) {
  const billingPath = slugPath(pathsConfig.app.accountBilling, slug);
  const planId =
    productId === 'ozer-business-starter'
      ? 'business-starter-monthly'
      : 'business-monthly';
  const query = new URLSearchParams({
    setup: '1',
    upgrade: '1',
    product: productId,
    plan: planId,
    interval: 'month',
    seats: String(seats),
  });
  return `${billingPath}?${query.toString()}`;
}
