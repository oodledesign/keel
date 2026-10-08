import { redirectIfBusinessFreeBlocked } from '../_lib/server/business-free-route-guard';

type Props = React.PropsWithChildren<{
  params: Promise<{ account: string }>;
}>;

export default async function ScheduleLayout({ children, params }: Props) {
  await redirectIfBusinessFreeBlocked((await params).account, 'schedule');

  return children;
}
