import type { MatchedPost } from "@/lib/types";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmtPrice(n?: number) {
  if (!n) return null;
  return `LKR ${n.toLocaleString()}`;
}

export function PostCard({ post }: { post: MatchedPost }) {
  const price = fmtPrice(post.priceLkr);
  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950/80 dark:hover:border-neutral-700 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
            {post.author}
          </div>
          <div className="mt-1 truncate text-xs text-neutral-500">
            {post.groupName}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {price && (
            <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
              {price}
            </span>
          )}
          <span className="text-xs text-neutral-500">{fmtDate(post.postedAt)}</span>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-700 dark:text-neutral-200">
        {post.text}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {post.matchedLocations.map((l) => (
          <span
            key={`loc-${l}`}
            className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
          >
            {l}
          </span>
        ))}
        {post.matchedMustKeywords.map((k) => (
          <span
            key={`must-${k}`}
            title="Must-have keyword"
            className="rounded-full bg-rose-100 px-2.5 py-1 text-xs text-rose-900 dark:bg-rose-900/50 dark:text-rose-100"
          >
            {k}
          </span>
        ))}
        {post.matchedGoodKeywords.map((k) => (
          <span
            key={`good-${k}`}
            title="Good-to-have keyword"
            className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
          >
            {k}
          </span>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <a
          href={post.permalink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-neutral-200 px-4 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 dark:border-neutral-800 dark:text-blue-400 dark:hover:bg-blue-950/30 sm:w-auto"
        >
          View on Facebook
        </a>
      </div>
    </article>
  );
}
