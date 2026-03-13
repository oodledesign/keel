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
      className="sticky top-0 z-20 border-b border-white/6 bg-[var(--workspace-shell-panel)] px-4 py-4 backdrop-blur-xl lg:px-4"
      displaySidebarTrigger={false}
    />
  );
}
