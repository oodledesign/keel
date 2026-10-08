import { redirectIfBusinessFreeBlocked } from '../_lib/server/business-free-route-guard';

type Props = React.PropsWithChildren<{
  params: Promise<{ account: string }>;
}>;

export default async function WebsitesLayout({ children, params }: Props) {
  await redirectIfBusinessFreeBlocked((await params).account, 'websites');

  return children;
}
