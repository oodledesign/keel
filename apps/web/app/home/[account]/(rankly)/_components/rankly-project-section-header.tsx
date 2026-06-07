export function RanklyProjectSectionHeader(props: {
  title: string;
  description?: string;
}) {
  return (
    <header className="space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
      {props.description ? (
        <p className="text-muted-foreground text-sm">{props.description}</p>
      ) : null}
    </header>
  );
}
