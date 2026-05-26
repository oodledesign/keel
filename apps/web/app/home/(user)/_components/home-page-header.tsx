import { PageHeader } from '@kit/ui/page';

export function HomeLayoutPageHeader(
  props: React.PropsWithChildren<{
    title: string | React.ReactNode;
    description: string | React.ReactNode;
  }>,
) {
  return (
    <PageHeader
      description={props.description}
      title={props.title}
      className="border-0 bg-transparent px-4 py-4 lg:px-6"
      displaySidebarTrigger={false}
    >
      {props.children}
    </PageHeader>
  );
}
