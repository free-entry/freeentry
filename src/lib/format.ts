/** Locale-aware date like "Sun 6 Sep 2026" from an ISO date string. */
export function formatDate(locale: string, iso: string, withWeekday = true): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    ...(withWeekday ? { weekday: 'short' } : {}),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** Locale-aware "3.4 km". */
export function formatKm(locale: string, km: number): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    maximumFractionDigits: km < 10 ? 1 : 0,
  }).format(km);
}

/** Localized standalone weekday name ("Sunday", "dimanche"). */
export function weekdayName(locale: string, weekday: string): string {
  // 2026-03-01 was a Sunday; offset from it to reach the requested weekday.
  const base: Record<string, number> = {
    sunday: 1,
    monday: 2,
    tuesday: 3,
    wednesday: 4,
    thursday: 5,
    friday: 6,
    saturday: 7,
  };
  const day = base[weekday] ?? 1;
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
    new Date(Date.UTC(2026, 2, day, 12)),
  );
}

/** Localized standalone month name for 1-based month numbers. */
export function monthName(locale: string, month: number): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    new Date(Date.UTC(2026, month - 1, 15, 12)),
  );
}
