type ModuleDataSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function ModuleDataSection(props: ModuleDataSectionProps) {
  return (
    <section className="space-y-3 px-4 lg:px-0">
      <div>
        <h2 className="text-lg font-medium">{props.title}</h2>
        {props.description ? (
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
            {props.description}
          </p>
        ) : null}
      </div>
      {props.children}
    </section>
  );
}

export function ModuleEmptyState(props: { message: string }) {
  return (
    <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
      {props.message}
    </p>
  );
}
