"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PostCard } from "@/components/PostCard";
import { apiGetAllPosts } from "@/lib/api";
import type { MatchedPost } from "@/lib/types";

type SortKey = "default" | "price_asc" | "price_desc";

function sortPosts(posts: MatchedPost[], sort: SortKey): MatchedPost[] {
  if (sort === "default") return posts;
  return [...posts].sort((a, b) => {
    const aPrice = a.priceLkr ?? (sort === "price_asc" ? Infinity : -Infinity);
    const bPrice = b.priceLkr ?? (sort === "price_asc" ? Infinity : -Infinity);
    return sort === "price_asc" ? aPrice - bPrice : bPrice - aPrice;
  });
}

export default function HomePage() {
  const [posts, setPosts] = useState<MatchedPost[]>([]);
  const [sort, setSort] = useState<SortKey>("default");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setPosts(await apiGetAllPosts());
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sortedPosts = sortPosts(posts, sort);

  return (
    <main className="relative isolate min-h-[calc(100vh-3rem)] overflow-hidden px-4 py-8 sm:py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_32rem),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28rem)]" />

      <section className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-2xl shadow-neutral-200/70 backdrop-blur dark:border-neutral-800/80 dark:bg-neutral-950/90 dark:shadow-black/30">
        <header className="flex flex-col gap-5 border-b border-neutral-200/80 px-5 py-6 dark:border-neutral-800 sm:px-8 sm:py-7 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Link
              href="/settings"
              className="inline-flex w-fit items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            >
              Edit filters
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
                Database
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                All posts
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                {loading
                  ? "Loading every scraped post from the database."
                  : `${posts.length} scraped post${posts.length === 1 ? "" : "s"} in the database.`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-72">
            <SummaryStat label="Posts" value={loading ? "..." : String(posts.length)} />
            <SummaryStat label="View" value="All" />
            {!loading && posts.length > 1 ? (
              <label className="col-span-2">
                <span className="sr-only">Sort posts</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-neutral-800 dark:bg-neutral-900/80"
                >
                  <option value="default">Latest first</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
              </label>
            ) : (
              <SummaryStat
                label="Sort"
                value={sort === "default" ? "Latest" : sort === "price_asc" ? "Low price" : "High price"}
                className="col-span-2"
              />
            )}
          </div>
        </header>

        {error && (
          <div className="mx-5 mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/80 dark:bg-red-950/40 dark:text-red-100 sm:mx-8">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-3 text-xs font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-5 p-5 sm:p-8">
          {loading ? (
            <LoadingList />
          ) : posts.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-3 sm:space-y-4">
              {sortedPosts.map((p) => (
                <li key={p.id}>
                  <PostCard post={p} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function SummaryStat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/80 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 truncate font-medium text-neutral-800 dark:text-neutral-100">
        {value}
      </p>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="space-y-3 sm:space-y-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm dark:border-neutral-700 dark:bg-neutral-950/80 sm:p-12">
      <div className="mx-auto max-w-sm">
        <h2 className="text-xl font-semibold tracking-tight">No posts in the database</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          Run the scraper from settings or wait for the next scheduled scrape.
        </p>
        <Link
          href="/settings"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
        >
          Open settings
        </Link>
      </div>
    </section>
  );
}
