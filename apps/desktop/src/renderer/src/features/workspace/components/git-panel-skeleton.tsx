export function GitPanelSkeleton() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="h-8 w-full bg-white/5" />
        <div className="flex gap-2">
          <div className="h-7 w-16 bg-white/5" />
          <div className="h-7 w-7 bg-white/5" />
        </div>
      </section>
      <div className="space-y-2">
        <div className="h-4 w-20 bg-white/5" />
        <div className="h-8 w-full bg-white/5" />
        <div className="h-8 w-full bg-white/5" />
      </div>
    </div>
  );
}
