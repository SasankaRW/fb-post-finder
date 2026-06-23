"use client";

import { useState } from "react";
import type { FbGroup } from "@/lib/types";

type Props = {
  groups: FbGroup[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onAdd: (group: { name: string; url: string }) => void;
  onRemove: (id: string) => void;
};

function isLikelyFbGroupUrl(url: string): boolean {
  return /^https?:\/\/([\w-]+\.)?facebook\.com\/groups\/[^/]+/i.test(url.trim());
}

export function GroupManager({ groups, selectedIds, onToggle, onAdd, onRemove }: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) {
      setError("Both name and URL are required.");
      return;
    }
    if (!isLikelyFbGroupUrl(trimmedUrl)) {
      setError("URL must look like https://www.facebook.com/groups/<group>");
      return;
    }
    onAdd({ name: trimmedName, url: trimmedUrl });
    setName("");
    setUrl("");
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Facebook groups to scrape</h3>
        <p className="text-xs text-neutral-500">
          Add groups your scraper account is a member of. Tick the ones to include in this search.
        </p>
      </div>

      <ul className="space-y-1.5">
        {groups.map((g) => {
          const checked = selectedIds.includes(g.id);
          return (
            <li
              key={g.id}
              className="flex items-center gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 p-2"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(g.id)}
                className="h-4 w-4"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{g.name}</div>
                <a
                  href={g.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
                >
                  {g.url}
                </a>
              </div>
              <button
                type="button"
                onClick={() => onRemove(g.id)}
                className="text-xs text-neutral-500 hover:text-red-600"
                aria-label={`Remove ${g.name}`}
              >
                Remove
              </button>
            </li>
          );
        })}
        {groups.length === 0 && (
          <li className="text-xs text-neutral-500 italic">No groups yet — add one below.</li>
        )}
      </ul>

      <form onSubmit={submit} className="space-y-2 rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.facebook.com/groups/..."
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5"
          >
            Add group
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </div>
  );
}
