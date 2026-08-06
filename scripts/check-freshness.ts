/**
 * Data freshness watchdog. Fails (exit 1) when any verified fact is older
 * than the re-verification interval — the signal that the yearly update
 * round is due. Checks:
 *
 *  - every free-access rule's source.checkedAt
 *  - every openingHoursSource.checkedAt
 *  - events.json coverage for the current year (missing = overdue) and the
 *    next year (missing = warning; dates are often announced late)
 *
 * Usage: npx tsx scripts/check-freshness.ts [--max-age-days N]  (default 365)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EventDates, Museum } from '../src/lib/types';

const ROOT = join(import.meta.dirname, '..');
const COUNTRY = process.env.COUNTRY ?? 'fr';
const museums: Museum[] = JSON.parse(readFileSync(join(ROOT, `data/${COUNTRY}/museums.json`), 'utf-8'));
const events: EventDates = JSON.parse(readFileSync(join(ROOT, `data/${COUNTRY}/events.json`), 'utf-8'));

const flagIdx = process.argv.indexOf('--max-age-days');
const MAX_AGE_DAYS = flagIdx !== -1 ? Number(process.argv[flagIdx + 1]) : 365;
const MS_PER_DAY = 86_400_000;
const now = Date.now();

function ageDays(isoDate: string): number {
  return Math.floor((now - Date.parse(isoDate)) / MS_PER_DAY);
}

const overdue: string[] = [];
const warnings: string[] = [];

let staleRules = 0;
for (const m of museums) {
  for (const rule of m.freeAccess) {
    const age = ageDays(rule.source.checkedAt);
    if (age > MAX_AGE_DAYS) {
      staleRules++;
      overdue.push(`rule ${m.id} [${rule.kind}] checked ${rule.source.checkedAt} (${age}d)`);
    }
  }
  if (m.openingHoursSource) {
    const age = ageDays(m.openingHoursSource.checkedAt);
    if (age > MAX_AGE_DAYS) {
      overdue.push(`hours ${m.id} checked ${m.openingHoursSource.checkedAt} (${age}d)`);
    }
  }
}

const thisYear = new Date(now).getFullYear();
for (const [key, calendar] of Object.entries(events)) {
  if (!calendar.confirmed[String(thisYear)]?.length) {
    overdue.push(`events: no confirmed ${key} dates for ${thisYear}`);
  }
  if (!calendar.confirmed[String(thisYear + 1)]?.length) {
    warnings.push(`events: no confirmed ${key} dates for ${thisYear + 1} yet — check the official announcement`);
  }
}

const staleHours = overdue.filter((l) => l.startsWith('hours ')).length;
console.log(
  `Freshness (max age ${MAX_AGE_DAYS}d): ${staleRules} stale rule(s), ${staleHours} stale hour set(s), ${overdue.length} overdue item(s), ${warnings.length} warning(s).`,
);
for (const w of warnings) console.log(`  ~ ${w}`);
if (overdue.length) {
  console.log('\nOverdue — re-verify against the cited sources:');
  for (const o of overdue) console.log(`  ! ${o}`);
  console.log('\nSee docs/DATA-UPDATE.md for the update runbook.');
  process.exitCode = 1;
} else {
  console.log('All data within the re-verification interval.');
}
