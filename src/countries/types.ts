/** Per-country deployment configuration — see docs/superpowers/specs/2026-08-06-countryization-design.md. */
export interface CountryConfig {
  code: string;
  basePath: string;
  siteUrl: string;
  repoUrl: string;
  /** Data-sanity bounds; also the map's fallback framing. */
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  adminAreas: {
    /** Admin-area code → display name (FR departments, IT provinces…). */
    names: Record<string, string>;
    /** Postal-code pattern a venue in the given area must match. */
    postalPrefix: (area: string) => RegExp;
    /** Cities split into numbered districts: area code → max district. */
    districtRanges: Record<string, number>;
  };
  /** Which variable-date event calendars this country's events.json carries. */
  eventKeys: string[];
}
