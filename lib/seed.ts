import type { FbGroup, Post } from "./types";

// Initial seeds for the JSON store on first run. Empty by design — the UI starts
// blank and groups are added by the user; posts are populated by the scraper.
export const SEED_GROUPS: FbGroup[] = [];
export const SEED_POSTS: Post[] = [];

// Autocomplete hints for the location / keyword multi-selects. Tailored to the
// initial use case (rentals around Malabe); edit freely.
export const SUGGESTED_LOCATIONS = [
  "Malabe",
  "Kaduwela",
  "Battaramulla",
  "Athurugiriya",
  "Kothalawala",
  "Thalahena",
  "Pelawatte",
  "Rajagiriya",
  "Kotte",
  "Nugegoda",
];

// "Must have" suggestions — hard requirements you want present in every match.
export const SUGGESTED_MUST_KEYWORDS = [
  "2 rooms",
  "two rooms",
  "2 bedroom",
  "kitchen",
  "attached bathroom",
  "parking",
];

// "Good to have" suggestions — alternatives where matching any one is enough.
export const SUGGESTED_GOOD_KEYWORDS = [
  "annex",
  "annexe",
  "house",
  "apartment",
  "furnished",
  "unfurnished",
];
