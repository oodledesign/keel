import { PageHeader } from '@kit/ui/page';
import { cn } from '@kit/ui/utils';

export async function TeamAccountLayoutPageHeader(
  props: React.PropsWithChildren<{
    title: string | React.ReactNode;
    description?: string | React.ReactNode;
    account: string;
    className?: string;
  }>,
) {
  return (
    <PageHeader
      description={props.description}
      title={props.title}
      className={cn(
        'flex border-0 bg-transparent px-4 py-2 lg:px-6',
        props.className,
      )}
      displaySidebarTrigger={false}
    >
      {props.children}
    </PageHeader>
  );
}
