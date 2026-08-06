/**
 * Country wordmark glyphs, shared by the header (currentColor) and the PWA
 * icon generator (white on blue). Each is inner SVG markup for a 32×32 viewBox.
 * fr: Eiffel Tower · it: Colosseum's broken outer wall · be: a Belgian belfry.
 */
export const COUNTRY_MARKS: Record<string, string> = {
  fr: `
    <path d="M15.25 7.2 15.62 2.5C15.7 1.95 16.3 1.95 16.38 2.5L16.75 7.2Z" />
    <rect x="14.5" y="5.1" width="3" height="2.1" rx=".45" />
    <path d="M16.85 7.2c.25 3.4.65 6.4 1.75 9.05h-5.2c1.1-2.65 1.5-5.65 1.75-9.05Z" />
    <rect x="12.1" y="16.15" width="7.8" height="2.05" rx=".35" />
    <path d="M12.5 18.2h7l1.8 3.8h-3.65l-.35-3.3h-2.6l-.35 3.3H10.7Z" />
    <rect x="9.45" y="21.95" width="13.1" height="2.05" rx=".35" />
    <path d="M10.13 24h11.74L26 30h-5.8a4.2 4.4 0 0 0-8.4 0H6Z" />`,
  it: `
    <path fill-rule="evenodd" d="M3 26.5V9.2Q3 7.4 4.8 7.4H16.4Q17.6 7.4 17.6 8.6V12.6H27.4Q28.8 12.6 28.8 14V26.5Z
      M5.2 15.1V11.9A1.5 1.5 0 0 1 8.2 11.9V15.1Z
      M10.2 15.1V11.9A1.5 1.5 0 0 1 13.2 11.9V15.1Z
      M5.2 21.4V18.2A1.5 1.5 0 0 1 8.2 18.2V21.4Z
      M10.2 21.4V18.2A1.5 1.5 0 0 1 13.2 18.2V21.4Z
      M15.2 21.4V18.2A1.5 1.5 0 0 1 18.2 18.2V21.4Z
      M20.2 21.4V18.2A1.5 1.5 0 0 1 23.2 18.2V21.4Z
      M5.2 26.5V24.2A1.5 1.5 0 0 1 8.2 24.2V26.5Z
      M10.2 26.5V24.2A1.5 1.5 0 0 1 13.2 24.2V26.5Z
      M15.2 26.5V24.2A1.5 1.5 0 0 1 18.2 24.2V26.5Z
      M20.2 26.5V24.2A1.5 1.5 0 0 1 23.2 24.2V26.5Z
      M25 26.5V24.2A1.5 1.5 0 0 1 28 24.2V26.5Z" />
    <rect x="2" y="27.5" width="28" height="2.1" rx=".4" />`,
  be: `
    <circle cx="16" cy="2.5" r="1.25" />
    <path d="M16 3.4 19.6 9.6H12.4Z" />
    <rect x="11.2" y="9.6" width="9.6" height="1.7" rx=".35" />
    <path fill-rule="evenodd" d="M12.2 11.3H19.8V23.8H12.2Z
      M13.85 17.05A2.15 2.15 0 1 0 18.15 17.05A2.15 2.15 0 1 0 13.85 17.05Z" />
    <rect x="10.6" y="23.8" width="10.8" height="1.9" rx=".35" />
    <rect x="8.6" y="25.7" width="14.8" height="2.4" rx=".4" />
    <rect x="6.8" y="28.1" width="18.4" height="1.6" rx=".4" />`,
};
