import type { Post, MatchedPost, SearchProfile } from "./types";

const NUMBER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
};

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (word) => NUMBER_WORDS[word] ?? word)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandNeedle(raw: string): string[] {
  const normalized = normalizeForMatch(raw);
  if (!normalized) return [];

  const variants = new Set([normalized]);
  const tokens = normalized.split(" ");
  const last = tokens[tokens.length - 1];

  if (last) {
    const swappedLast =
      last.endsWith("s") && last.length > 3 ? last.slice(0, -1) : `${last}s`;
    variants.add([...tokens.slice(0, -1), swappedLast].join(" "));
  }

  const roomCount = tokens.find((token) => /^\d+$/.test(token));
  const hasRoomWord = tokens.some((token) =>
    ["room", "rooms", "bed", "beds", "bedroom", "bedrooms", "br"].includes(token),
  );

  if (roomCount && hasRoomWord) {
    for (const word of ["room", "rooms", "bed", "beds", "bedroom", "bedrooms", "br"]) {
      variants.add(`${roomCount} ${word}`);
    }
  }

  return [...variants];
}

function findMatches(haystack: string, needles: string[]): string[] {
  const normHaystack = normalizeForMatch(haystack);
  const found = new Set<string>();
  for (const n of needles) {
    if (expandNeedle(n).some((variant) => normHaystack.includes(variant))) {
      found.add(n);
    }
  }
  return [...found];
}

export function filterPosts(posts: Post[], profile: SearchProfile): MatchedPost[] {
  const groupFilter = new Set(profile.groupIds);
  const hasGroupFilter = groupFilter.size > 0;
  const hasLocations = profile.locations.length > 0;
  const hasMust = profile.mustKeywords.length > 0;
  const hasGood = profile.goodKeywords.length > 0;
  const hasPriceFilter =
    profile.priceMinLkr != null || profile.priceMaxLkr != null;
  const ageCutoffMs =
    profile.maxAgeHours != null && profile.maxAgeHours > 0
      ? Date.now() - profile.maxAgeHours * 3600_000
      : null;

  const matched: MatchedPost[] = [];
  for (const post of posts) {
    if (hasGroupFilter && !groupFilter.has(post.groupId)) continue;

    // Age check first — cheapest.
    if (ageCutoffMs != null) {
      const postedMs = Date.parse(post.postedAt);
      if (Number.isFinite(postedMs) && postedMs < ageCutoffMs) continue;
    }

    // Price check.
    if (hasPriceFilter) {
      if (post.priceLkr == null) {
        if (!profile.includeUnpriced) continue;
      } else {
        if (profile.priceMinLkr != null && post.priceLkr < profile.priceMinLkr) continue;
        if (profile.priceMaxLkr != null && post.priceLkr > profile.priceMaxLkr) continue;
      }
    }

    const locationHaystack = `${post.text} ${post.groupName}`;
    const matchedLocations = hasLocations ? findMatches(locationHaystack, profile.locations) : [];
    const matchedMust = hasMust ? findMatches(post.text, profile.mustKeywords) : [];
    const matchedGood = hasGood ? findMatches(post.text, profile.goodKeywords) : [];

    // Locations: OR — at least one must match (if any are set).
    if (hasLocations && matchedLocations.length === 0) continue;
    // Must keywords: AND — every one must be present.
    if (hasMust && matchedMust.length !== profile.mustKeywords.length) continue;
    // Good keywords: OR — at least one must match (if any are set).
    if (hasGood && matchedGood.length === 0) continue;

    matched.push({
      ...post,
      matchedLocations,
      matchedMustKeywords: matchedMust,
      matchedGoodKeywords: matchedGood,
    });
  }

  matched.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
  return matched;
}
