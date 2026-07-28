/** Shimmer placeholder rows for the chat list while it loads. */
export default function ChatListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-700/50">
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-700/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
