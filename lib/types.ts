export type FbGroup = {
  id: string;
  name: string;
  url: string;
  addedAt: string;
};

export type Post = {
  id: string;
  groupId: string;
  groupName: string;
  author: string;
  text: string;
  permalink: string;
  postedAt: string;
  priceLkr?: number;
};

export type SearchProfile = {
  // Any location matches (OR). A post is in one place.
  locations: string[];
  // ALL must be present in the post text (AND). Use for hard requirements
  // like number of rooms or amenities you can't compromise on.
  mustKeywords: string[];
  // AT LEAST ONE must be present (OR). Used for alternatives — e.g. "annex"
  // OR "apartment" OR "house". If empty, this filter is skipped.
  goodKeywords: string[];
  groupIds: string[];
  // Price range in LKR. Undefined = no bound on that side.
  priceMinLkr?: number;
  priceMaxLkr?: number;
  // If true, posts whose text doesn't state a price are still shown when a
  // price filter is active. Many real posts don't list a number.
  includeUnpriced: boolean;
  // Only show posts younger than this many hours. Undefined = no age filter.
  maxAgeHours?: number;
};

export type MatchedPost = Post & {
  matchedLocations: string[];
  matchedMustKeywords: string[];
  matchedGoodKeywords: string[];
};
