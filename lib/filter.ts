import type { Post, MatchedPost, SearchProfile } from "./types";

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function findMatches(haystack: string, needles: string[]): string[] {
  const normHaystack = normalizeForMatch(haystack);
  const found = new Set<string>();
  for (const n of needles) {
    const normNeedle = normalizeForMatch(n);
    if (!normNeedle) continue;
    if (normHaystack.includes(normNeedle)) found.add(n);
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

    const matchedLocations = hasLocations ? findMatches(post.text, profile.locations) : [];
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
