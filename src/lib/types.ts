/** French department code ('01'…'95', '2A'/'2B', '971'…'976') — validated in tests. */
export type Department = string;

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type EventKey = 'museum-night' | 'heritage-days';

/**
 * Who a free-admission rule applies to. 'everyone' is the default and is
 * omitted from stored rules; every other value narrows the rule to visitors
 * who belong to that group.
 */
export type Audience =
  | 'everyone'
  | 'under-18'
  | 'under-26-eu'
  | 'under-26'
  | 'over-65'
  | 'students'
  | 'teachers'
  | 'jobseekers'
  /** Recipients of means-tested benefits (FR: *minima sociaux*). */
  | 'income-support'
  | 'disabled'
  | 'disabled-companion'
  /** ICOM cardholders (museum professionals). */
  | 'icom'
  | 'residents';

/** Every audience a visitor can claim — 'everyone' is not a choice. */
export const SELECTABLE_AUDIENCES = [
  'under-18',
  'under-26-eu',
  'under-26',
  'over-65',
  'students',
  'teachers',
  'jobseekers',
  'income-support',
  'disabled',
  'disabled-companion',
  'icom',
  'residents',
] as const satisfies readonly Audience[];

export interface RuleSource {
  url: string;
  /** ISO date the rule was last verified against the source. */
  checkedAt: string;
}

/**
 * One way a museum can be visited for free. Rules are evaluated against a
 * calendar date; display categories are derived from the full rule set.
 */
/** How much of the venue the free admission covers. Omitted means all of it. */
export type FreeScope = 'partial' | 'grounds' | 'permanent-collection';

export interface FreeRule {
  kind: 'always' | 'nth-weekday' | 'weekly' | 'event' | 'annual-date';
  /** Restricts the rule to part of the venue; omitted = the whole venue. */
  scope?: FreeScope;
  /** weekly: free every <weekday> (evening flag for evening-only slots). */
  /** nth-weekday: 1 = first <weekday> of the month, -1 = last. */
  nth?: 1 | -1;
  weekday?: Weekday;
  /** 1–12 subset the rule applies to; omitted = all year. */
  months?: number[];
  event?: EventKey;
  /** 'MM-DD' for annual-date rules (e.g. '07-14'). */
  date?: string;
  /** Free during an evening slot only (monthly nocturnes). */
  evening?: boolean;
  audience?: Audience;
  reservationRequired?: boolean;
  reservationUrl?: string;
  /** Short clarification in English, translated at display time via data/i18n/notes.<locale>.json. */
  note?: string;
  /** The note is a more detailed version of the rule — render it instead of the generated sentence. */
  noteReplacesSentence?: boolean;
  source: RuleSource;
}

/** Detail-page header photo and its attribution. */
export interface MuseumImage {
  /** Path relative to /public, e.g. "images/museums/arc-de-triomphe.jpg". */
  file: string;
  author: string;
  /** Canonical short form, e.g. "CC BY-SA 4.0", "CC0 1.0", "Public Domain". */
  license: string;
  /** Commons file page, or the manually-supplied source when overridden. */
  sourceUrl: string;
  /** "File:Xxx.jpg" — set only when sourced from Wikimedia Commons. */
  wikimediaFile?: string;
}

export interface Museum {
  id: string;
  /** Official French name — always displayed, in every locale. */
  name: string;
  /** [longitude, latitude], WGS84. */
  coordinates: [number, number];
  address: string;
  postalCode: string;
  commune: string;
  /** 1–20, Paris only. */
  arrondissement?: number;
  department: Department;
  website?: string;
  phone?: string;
  /** Restricted OSM opening_hours syntax (e.g. 'Tu-Su 10:00-18:00'). */
  openingHours?: string;
  /** Where and when the opening hours were last verified. */
  openingHoursSource?: RuleSource;
  tags: string[];
  freeAccess: FreeRule[];
  parisjetaimeUrl?: string;
  /** Muséofile register id (e.g. 'M5031') — identity key for data.gouv diffs. */
  museofile?: string;
  /** Wikidata item id (e.g. 'Q19675'). */
  wikidata?: string;
  /** French Wikipedia article URL, from the item's frwiki sitelink. */
  wikipedia?: string;
  /** Detail-page header photo, sourced from the Wikidata item's image (P18)
   *  or a manual override — see scripts/enrich-images.ts. */
  image?: MuseumImage;
  /** Dated windows when the venue is shut. Free admission may still apply on
   *  those dates — free and open are separate facts, and the UI says so. */
  closures?: { from: string; to: string }[];
  /** ISO date, or a bare year, the venue reopens on after a long closure. */
  closedUntil?: string;
  /** Step-free access, as stated on the venue's own information page. */
  wheelchair?: 'yes' | 'partial' | 'no';
  /** Standard ticket prices, for the times the venue is not free. */
  admission?: { currency: string; full: number; reduced?: number };
  /** Venue-level caveat shown on the detail page (e.g. temporary closure). */
  note?: string;
}

export interface EventCalendar {
  /** Officially announced dates, keyed by year ('2026' → ['2026-05-16']). */
  confirmed: Record<string, string[]>;
}

export type EventDates = Record<EventKey, EventCalendar>;

/** Per-locale museum content (data/i18n/museums.<locale>.json). */
export interface MuseumContent {
  /** Conventional translated name, only where one exists (e.g. 卢浮宫). */
  name?: string;
  description?: string;
}
