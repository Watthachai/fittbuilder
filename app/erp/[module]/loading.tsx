/** A shape rather than a spinner: the page arrives where the grey already was. */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-56 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-2 h-3 w-80 rounded bg-slate-200/70 dark:bg-slate-800/70" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
        ))}
      </div>
      <div className="mt-3 h-64 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
    </div>
  );
}
