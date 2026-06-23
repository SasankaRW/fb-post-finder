"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { MultiSelect } from "@/components/MultiSelect";
import { GroupManager } from "@/components/GroupManager";
import {
  SUGGESTED_GOOD_KEYWORDS,
  SUGGESTED_LOCATIONS,
  SUGGESTED_MUST_KEYWORDS,
} from "@/lib/seed";
import {
  apiAddGroup,
  apiGetGroups,
  apiGetProfile,
  apiGetScrapeStatus,
  apiRemoveGroup,
  apiSaveProfile,
  apiTriggerScrape,
} from "@/lib/api";
import type { ScrapeStatus } from "@/lib/api";
import type { FbGroup, SearchProfile } from "@/lib/types";

const EMPTY_PROFILE: SearchProfile = {
  locations: [],
  mustKeywords: [],
  goodKeywords: [],
  groupIds: [],
  includeUnpriced: true,
};

const AGE_PRESETS: Array<{ label: string; hours: number | undefined }> = [
  { label: "Any time", hours: undefined },
  { label: "Last 24 hours", hours: 24 },
  { label: "Last 3 days", hours: 24 * 3 },
  { label: "Last 7 days", hours: 24 * 7 },
  { label: "Last 30 days", hours: 24 * 30 },
];

export default function SettingsPage() {
  const [groups, setGroups] = useState<FbGroup[]>([]);
  const [profile, setProfile] = useState<SearchProfile>(EMPTY_PROFILE);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [confirmScrape, setConfirmScrape] = useState(false);
  const [scrapeRunning, setScrapeRunning] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [g, p, s] = await Promise.all([
          apiGetGroups(),
          apiGetProfile(),
          apiGetScrapeStatus().catch(() => null),
        ]);
        setGroups(g);
        setProfile(p);
        setScrapeStatus(s);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
        initialized.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    const t = setTimeout(async () => {
      try {
        await apiSaveProfile(profile);
        setSavedAt(new Date());
      } catch (e: any) {
        setError(e.message || "Failed to save");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [profile]);

  async function handleAddGroup(input: { name: string; url: string }) {
    try {
      const g = await apiAddGroup(input);
      setGroups((prev) => [...prev, g]);
      setProfile((p) => ({ ...p, groupIds: [...p.groupIds, g.id] }));
    } catch (e: any) {
      setError(e.message || "Failed to add group");
    }
  }

  async function handleRemoveGroup(id: string) {
    try {
      await apiRemoveGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setProfile((p) => ({ ...p, groupIds: p.groupIds.filter((x) => x !== id) }));
    } catch (e: any) {
      setError(e.message || "Failed to remove group");
    }
  }

  function toggleGroup(id: string) {
    setProfile((p) => ({
      ...p,
      groupIds: p.groupIds.includes(id)
        ? p.groupIds.filter((x) => x !== id)
        : [...p.groupIds, id],
    }));
  }

  async function handleForceScrape() {
    setScrapeRunning(true);
    setScrapeMessage(null);
    setError(null);
    setConfirmScrape(false);

    try {
      const result = await apiTriggerScrape();
      setScrapeMessage(`${result.message} Running ${result.workflowId} on ${result.ref}.`);
    } catch (e: any) {
      setError(e.message || "Failed to start scrape");
    } finally {
      setScrapeRunning(false);
    }
  }

  return (
    <main className="relative isolate min-h-[calc(100vh-3rem)] overflow-hidden px-4 py-8 sm:py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_32rem),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28rem)]" />

      <section className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-2xl shadow-neutral-200/70 backdrop-blur dark:border-neutral-800/80 dark:bg-neutral-950/90 dark:shadow-black/30">
        <header className="flex flex-col gap-5 border-b border-neutral-200/80 px-5 py-6 dark:border-neutral-800 sm:px-8 sm:py-7 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-flex w-fit items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            >
              Back to posts
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
                Preferences
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                Settings
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                Keep the filters simple. Changes save automatically as you tune
                what the scraper should surface.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/80">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Save status
            </p>
            <p className="mt-1 font-medium text-neutral-800 dark:text-neutral-100">
              {savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Autosave on"}
            </p>
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

        {loading ? (
          <div className="grid gap-4 p-5 sm:p-8 md:grid-cols-2">
            <div className="h-56 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" />
            <div className="h-56 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" />
          </div>
        ) : (
          <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <ScrapePanel
                status={scrapeStatus}
                message={scrapeMessage}
                running={scrapeRunning}
                onForce={() => setConfirmScrape(true)}
              />

              <SettingsSection
                eyebrow="Limits"
                title="Price and date"
                description="Keep noisy posts out without over-tuning the search."
              >
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Price range (LKR / month)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <PriceInput
                      placeholder="Min"
                      value={profile.priceMinLkr}
                      onChange={(priceMinLkr) => setProfile((p) => ({ ...p, priceMinLkr }))}
                    />
                    <PriceInput
                      placeholder="Max"
                      value={profile.priceMaxLkr}
                      onChange={(priceMaxLkr) => setProfile((p) => ({ ...p, priceMaxLkr }))}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <input
                      type="checkbox"
                      checked={profile.includeUnpriced}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, includeUnpriced: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    Also show posts that do not state a price
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Posted within</label>
                  <select
                    value={profile.maxAgeHours ?? ""}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        maxAgeHours: e.target.value === "" ? undefined : Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    {AGE_PRESETS.map((opt) => (
                      <option key={opt.label} value={opt.hours ?? ""}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-5 text-neutral-500">
                    Based on when the scraper first saw the post.
                  </p>
                </div>
              </SettingsSection>
            </div>

            <div className="space-y-5">
              <SettingsSection
                eyebrow="Search"
                title="Filters"
                description="Use must-have keywords for hard requirements and good-to-have keywords for flexible matches."
              >
                <MultiSelect
                  label="Locations"
                  placeholder="e.g. Malabe, Kaduwela"
                  suggestions={SUGGESTED_LOCATIONS}
                  selected={profile.locations}
                  onChange={(locations) => setProfile((p) => ({ ...p, locations }))}
                />
                <p className="-mt-3 text-xs text-neutral-500">
                  A post is included if it mentions any one location.
                </p>

                <MultiSelect
                  label="Must-have keywords"
                  placeholder="e.g. 2 rooms, kitchen"
                  suggestions={SUGGESTED_MUST_KEYWORDS}
                  selected={profile.mustKeywords}
                  onChange={(mustKeywords) => setProfile((p) => ({ ...p, mustKeywords }))}
                />
                <p className="-mt-3 text-xs text-neutral-500">
                  All of these must appear in the post.
                </p>

                <MultiSelect
                  label="Good-to-have keywords"
                  placeholder="e.g. annex, apartment, house"
                  suggestions={SUGGESTED_GOOD_KEYWORDS}
                  selected={profile.goodKeywords}
                  onChange={(goodKeywords) => setProfile((p) => ({ ...p, goodKeywords }))}
                />
                <p className="-mt-3 text-xs text-neutral-500">
                  Any one of these is enough. Leave empty to skip.
                </p>
              </SettingsSection>

              <SettingsSection
                eyebrow="Sources"
                title="Facebook groups"
                description="Choose which configured groups should feed this search."
              >
                <GroupManager
                  groups={groups}
                  selectedIds={profile.groupIds}
                  onToggle={toggleGroup}
                  onAdd={handleAddGroup}
                  onRemove={handleRemoveGroup}
                />
              </SettingsSection>
            </div>
          </div>
        )}
      </section>

      {confirmScrape && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/50 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="force-scrape-title"
            className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              Confirmation
            </p>
            <h2
              id="force-scrape-title"
              className="mt-2 text-xl font-semibold tracking-tight"
            >
              Run scrape now?
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              This will trigger the GitHub Actions workflow and may take a few
              minutes before new posts appear.
            </p>
            {scrapeStatus && (
              <p className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
                Next scheduled scrape is {formatDateTime(scrapeStatus.nextScrapeAt)}.
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmScrape(false)}
                disabled={scrapeRunning}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForceScrape}
                disabled={scrapeRunning}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {scrapeRunning ? "Starting..." : "Yes, run scrape"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function SettingsSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function ScrapePanel({
  status,
  message,
  running,
  onForce,
}: {
  status: ScrapeStatus | null;
  message: string | null;
  running: boolean;
  onForce: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-blue-100 bg-blue-600 text-white shadow-xl shadow-blue-600/20 dark:border-blue-900">
      <div className="bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_16rem)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
          Scraper
        </p>
        <h2 className="mt-2 text-lg font-semibold">Next scrape</h2>
        <p className="mt-3 text-2xl font-semibold tracking-tight">
          {status ? formatDateTime(status.nextScrapeAt) : "Loading..."}
        </p>
        {status && (
          <p className="mt-1 text-sm text-blue-100">
            {formatRelative(status.nextScrapeAt)}
          </p>
        )}

        <button
          type="button"
          onClick={onForce}
          disabled={running || !status?.canTrigger}
          className="mt-5 w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-lg shadow-blue-950/10 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-blue-100 disabled:text-blue-300"
        >
          {running ? "Queuing..." : "Force scrape now"}
        </button>

        {message && <p className="mt-3 text-sm text-blue-50">{message}</p>}
        {status && !status.canTrigger && (
          <p className="mt-3 text-xs leading-5 text-blue-100">
            Manual runs need GITHUB_WORKFLOW_TOKEN and GITHUB_REPOSITORY in the
            app environment.
          </p>
        )}
      </div>
    </section>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMinutes = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 60_000));

  if (diffMinutes < 1) return "Due now";
  if (diffMinutes < 60) return `In ${diffMinutes} min`;

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes ? `In ${hours}h ${minutes}m` : `In ${hours}h`;
}

function PriceInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 dark:border-neutral-800 dark:bg-neutral-950">
      <span className="text-xs text-neutral-500">LKR</span>
      <input
        type="number"
        min={0}
        step={1000}
        inputMode="numeric"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(undefined);
          const n = Number(raw);
          onChange(Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined);
        }}
        className="flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}
