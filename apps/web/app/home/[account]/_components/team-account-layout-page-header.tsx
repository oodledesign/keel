import { PageHeader } from '@kit/ui/page';

export async function TeamAccountLayoutPageHeader(
  props: React.PropsWithChildren<{
    title: string | React.ReactNode;
    description?: string | React.ReactNode;
    account: string;
  }>,
) {
  return (
    <PageHeader
      description={props.description}
      title={props.title}
      className="hidden border-0 bg-transparent px-4 py-4 lg:block lg:px-6"
      displaySidebarTrigger={false}
    >
      {props.children}
    </PageHeader>
  );
}
