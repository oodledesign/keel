export default function BlogPostLoading() {
  return (
    <div className="container mx-auto max-w-3xl animate-pulse px-4 py-10 xl:py-14">
      <div className="border-border/40 mb-10 border-b pb-8">
        <div className="bg-muted h-10 w-4/5 rounded-md" />
        <div className="mt-4 flex gap-3">
          <div className="bg-muted h-4 w-24 rounded" />
          <div className="bg-muted h-4 w-32 rounded" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-muted h-4 w-full rounded" />
        <div className="bg-muted h-4 w-full rounded" />
        <div className="bg-muted h-4 w-5/6 rounded" />
        <div className="bg-muted h-4 w-full rounded" />
        <div className="bg-muted h-4 w-4/5 rounded" />
      </div>
    </div>
  );
}
