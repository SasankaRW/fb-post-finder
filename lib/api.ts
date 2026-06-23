import type { FbGroup, MatchedPost, SearchProfile } from "./types";

export type ScrapeStatus = {
  cron: string;
  scheduleLabel: string;
  workflowId: string;
  nextScrapeAt: string;
  canTrigger: boolean;
};

export type ScrapeTriggerResult = {
  ok: true;
  message: string;
  repository: string;
  workflowId: string;
  ref: string;
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function apiGetGroups(): Promise<FbGroup[]> {
  const data = await jsonOrThrow<{ groups: FbGroup[] }>(await fetch("/api/groups"));
  return data.groups;
}

export async function apiAddGroup(input: { name: string; url: string }): Promise<FbGroup> {
  const data = await jsonOrThrow<{ group: FbGroup }>(
    await fetch("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return data.group;
}

export async function apiRemoveGroup(id: string): Promise<void> {
  await jsonOrThrow<{ ok: true }>(
    await fetch(`/api/groups?id=${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}

export async function apiGetProfile(): Promise<SearchProfile> {
  const data = await jsonOrThrow<{ profile: SearchProfile }>(await fetch("/api/profile"));
  return data.profile;
}

export async function apiSaveProfile(profile: SearchProfile): Promise<SearchProfile> {
  const data = await jsonOrThrow<{ profile: SearchProfile }>(
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    }),
  );
  return data.profile;
}

export async function apiGetMatchedPosts(profile: SearchProfile): Promise<MatchedPost[]> {
  const q = new URLSearchParams({
    locations: profile.locations.join(","),
    mustKeywords: profile.mustKeywords.join(","),
    goodKeywords: profile.goodKeywords.join(","),
    groupIds: profile.groupIds.join(","),
    includeUnpriced: profile.includeUnpriced ? "true" : "false",
  });
  if (profile.priceMinLkr != null) q.set("priceMinLkr", String(profile.priceMinLkr));
  if (profile.priceMaxLkr != null) q.set("priceMaxLkr", String(profile.priceMaxLkr));
  if (profile.maxAgeHours != null) q.set("maxAgeHours", String(profile.maxAgeHours));
  const data = await jsonOrThrow<{ posts: MatchedPost[] }>(
    await fetch(`/api/posts?${q.toString()}`),
  );
  return data.posts;
}

export async function apiGetAllPosts(): Promise<MatchedPost[]> {
  const data = await jsonOrThrow<{ posts: MatchedPost[] }>(await fetch("/api/posts"));
  return data.posts;
}

export async function apiGetScrapeStatus(): Promise<ScrapeStatus> {
  const data = await jsonOrThrow<{ scrape: ScrapeStatus }>(await fetch("/api/scrape"));
  return data.scrape;
}

export async function apiTriggerScrape(): Promise<ScrapeTriggerResult> {
  return jsonOrThrow<ScrapeTriggerResult>(await fetch("/api/scrape", { method: "POST" }));
}
