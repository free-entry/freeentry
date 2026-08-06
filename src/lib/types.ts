export type Department = '75' | '77' | '78' | '91' | '92' | '93' | '94' | '95';

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type EventKey = 'museum-night' | 'heritage-days';

export type Audience = 'everyone' | 'under-26-eu' | 'under-18';

export interface RuleSource {
  url: string;
  /** ISO date the rule was last verified against the source. */
  checkedAt: string;
}

/**
 * One way a museum can be visited for free. Rules are evaluated against a
 * calendar date; display categories are derived from the full rule set.
 */
export interface FreeRule {
  kind: 'always' | 'nth-weekday' | 'event' | 'annual-date';
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
  /** Short clarification in English, translated at display time when possible. */
  note?: string;
  source: RuleSource;
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
  openingHours?: string;
  tags: string[];
  freeAccess: FreeRule[];
  parisjetaimeUrl?: string;
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
