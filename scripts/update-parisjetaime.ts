/**
 * Manual data-refresh script — run periodically with `npm run update-data`.
 *
 * Fetches the parisjetaime.com free-museums article, re-derives every rule
 * whose provenance is parisjetaime.com, and rewrites data/museums.json.
 * Rules curated from other sources (official museum sites) are never touched.
 *
 * Flags:
 *   --dry-run   print the diff without writing
 *   --fixture   parse scripts/fixtures/fr/parisjetaime.html instead of fetching
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EventDates, FreeRule, Museum } from '../src/lib/types';
import { eventDatesForYear } from '../src/lib/freeRules';
import { parseArticle, type ScrapedEntry } from './lib/parseArticle';
import { matchMuseum } from './lib/matchMuseums';

const ARTICLE_URL = 'https://parisjetaime.com/article/les-musees-et-monuments-gratuits-a-paris-a961';
const ROOT = join(import.meta.dirname, '..');
const MUSEUMS_PATH = join(ROOT, 'data/fr/museums.json');
const ALIASES_PATH = join(ROOT, 'data/fr/aliases.json');
const OVERRIDES_PATH = join(ROOT, 'data/fr/overrides.json');
const EVENTS_PATH = join(ROOT, 'data/fr/events.json');

interface Overrides {
  /** Per-museum nocturne schedules (section text is too free-form to parse). */
  nocturnes: Record<
    string,
    { weekday: FreeRule['weekday']; months?: number[]; note?: string }
  >;
  /** Museums whose first-Sunday free entry requires booking a ticket. */
  firstSundayBooking: string[];
  /** Caveats attached to always-free rules (partial openings, exhibitions…). */
  alwaysNotes: Record<string, string>;
  /** Scraped names that are deliberately out of scope (outside IDF, closed venues). */
  skip: string[];
}

interface Aliases {
  [scrapedName: string]: string;
}

const TODAY = new Date().toISOString().slice(0, 10);

function pjtSource(): FreeRule['source'] {
  return { url: ARTICLE_URL, checkedAt: TODAY };
}

/** Builds the FreeRule a section membership implies for a given museum. */
function ruleForSection(entry: ScrapedEntry, museumId: string, overrides: Overrides): FreeRule | null {
  const source = pjtSource();
  switch (entry.sectionKey) {
    case 'always': {
      const note = overrides.alwaysNotes[museumId];
      return { kind: 'always', ...(note ? { note } : {}), source };
    }
    case 'first-sunday':
      return {
        kind: 'nth-weekday',
        nth: 1,
        weekday: 'sunday',
        ...(overrides.firstSundayBooking.includes(museumId) ? { reservationRequired: true } : {}),
        source,
      };
    case 'first-sunday-oct-mar':
      return { kind: 'nth-weekday', nth: 1, weekday: 'sunday', months: [10, 11, 12, 1, 2, 3], source };
    case 'first-sunday-nov-mar':
      return { kind: 'nth-weekday', nth: 1, weekday: 'sunday', months: [11, 12, 1, 2, 3], source };
    case 'first-saturday-oct-jun':
      return {
        kind: 'nth-weekday',
        nth: 1,
        weekday: 'saturday',
        months: [10, 11, 12, 1, 2, 3, 4, 5, 6],
        source,
      };
    case 'nocturne': {
      const detail = overrides.nocturnes[museumId];
      if (!detail) {
        console.warn(
          `! ${museumId}: in the nocturne section but data/overrides.json has no schedule — using a generic evening rule; please add one.`,
        );
        return {
          kind: 'nth-weekday',
          nth: 1,
          weekday: 'friday',
          evening: true,
          note: 'Free monthly evening opening — check the museum website for the exact day',
          source,
        };
      }
      return {
        kind: 'nth-weekday',
        nth: 1,
        weekday: detail.weekday,
        ...(detail.months ? { months: detail.months } : {}),
        evening: true,
        ...(detail.note ? { note: detail.note } : {}),
        source,
      };
    }
    case 'july-14':
      return { kind: 'annual-date', date: '07-14', source };
    case 'under-26':
      return { kind: 'always', audience: 'under-26-eu', source };
    default:
      return null;
  }
}

/** Content comparison that ignores volatile fields (checkedAt). */
function ruleFingerprint(rule: FreeRule): string {
  const { source, ...rest } = rule;
  return JSON.stringify({ ...rest, sourceUrl: source.url });
}

/**
 * Semantic identity of a rule regardless of provenance/notes. When a museum
 * already has a hand-curated rule (official source) with the same semantics,
 * the redundant article-derived rule is not added — better provenance wins.
 */
function ruleSemanticKey(rule: FreeRule): string {
  return JSON.stringify({
    kind: rule.kind,
    weekday: rule.weekday ?? null,
    months: rule.months ?? null,
    evening: rule.evening ?? false,
    audience: rule.audience ?? 'everyone',
    date: rule.date ?? null,
    event: rule.event ?? null,
  });
}

function isPjtRule(rule: FreeRule): boolean {
  return rule.source.url.includes('parisjetaime.com');
}

function describeRule(rule: FreeRule): string {
  const bits: string[] = [rule.kind];
  if (rule.weekday) bits.push(rule.weekday);
  if (rule.months) bits.push(`months ${rule.months.join(',')}`);
  if (rule.date) bits.push(rule.date);
  if (rule.event) bits.push(rule.event);
  if (rule.evening) bits.push('evening');
  if (rule.audience && rule.audience !== 'everyone') bits.push(rule.audience);
  if (rule.reservationRequired) bits.push('booking required');
  return bits.join(' · ');
}

async function loadHtml(useFixture: boolean): Promise<string> {
  if (useFixture) {
    return readFileSync(join(import.meta.dirname, 'fixtures/fr/parisjetaime.html'), 'utf-8');
  }
  const res = await fetch(ARTICLE_URL, {
    headers: { 'User-Agent': 'free-museums-france data updater (github.com/travel-eu/free-museums-france)' },
  });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const useFixture = process.argv.includes('--fixture');

  const museums: Museum[] = JSON.parse(readFileSync(MUSEUMS_PATH, 'utf-8'));
  const aliases: Aliases = JSON.parse(readFileSync(ALIASES_PATH, 'utf-8'));
  const overrides: Overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'));
  const events: EventDates = JSON.parse(readFileSync(EVENTS_PATH, 'utf-8'));

  const html = await loadHtml(useFixture);
  const parsed = parseArticle(html);
  if (parsed.sections.length < 6) {
    throw new Error(
      `Only ${parsed.sections.length} category sections recognized — the page layout probably changed; aborting without writing.`,
    );
  }

  // Scraped rules grouped by museum id.
  const scrapedRules = new Map<string, FreeRule[]>();
  const scrapedUrls = new Map<string, string>();
  const unmatched: ScrapedEntry[] = [];
  for (const entry of parsed.entries) {
    if (overrides.skip.includes(entry.name)) continue;
    const m = matchMuseum(entry.name, museums, aliases);
    if (!m) {
      unmatched.push(entry);
      continue;
    }
    const rule = ruleForSection(entry, m.id, overrides);
    if (!rule) continue;
    const list = scrapedRules.get(m.id) ?? [];
    // The same museum can legitimately appear once per section, never twice in one.
    if (!list.some((r) => ruleFingerprint(r) === ruleFingerprint(rule))) list.push(rule);
    scrapedRules.set(m.id, list);
    if (entry.url && !scrapedUrls.has(m.id)) scrapedUrls.set(m.id, entry.url);
  }

  // Merge: keep non-parisjetaime rules, replace parisjetaime ones.
  let changed = 0;
  for (const museum of museums) {
    const kept = museum.freeAccess.filter((r) => !isPjtRule(r));
    const oldPjt = museum.freeAccess.filter(isPjtRule);
    const keptKeys = new Set(kept.map(ruleSemanticKey));
    const newPjt = (scrapedRules.get(museum.id) ?? []).filter(
      (r) => !keptKeys.has(ruleSemanticKey(r)),
    );

    const oldPrints = new Map(oldPjt.map((r) => [ruleFingerprint(r), r]));
    const added = newPjt.filter((r) => !oldPrints.has(ruleFingerprint(r)));
    const removed = oldPjt.filter((r) => !newPjt.some((n) => ruleFingerprint(n) === ruleFingerprint(r)));

    // Unchanged rules keep their original checkedAt to avoid noisy diffs.
    const merged = newPjt.map((r) => oldPrints.get(ruleFingerprint(r)) ?? r);
    museum.freeAccess = [...merged, ...kept];

    const url = scrapedUrls.get(museum.id);
    if (url && museum.parisjetaimeUrl !== url) {
      museum.parisjetaimeUrl = url;
    }

    if (added.length || removed.length) {
      changed++;
      console.log(`\n${museum.name} (${museum.id})`);
      for (const r of added) console.log(`  + ${describeRule(r)}`);
      for (const r of removed) console.log(`  - ${describeRule(r)}`);
    }
  }

  if (unmatched.length) {
    console.log('\nUnmatched entries (add to data/aliases.json or create records):');
    for (const e of unmatched) console.log(`  ? [${e.sectionKey}] ${e.name}${e.url ? ` <${e.url}>` : ''}`);
  }

  // Yearly maintenance reminder for variable-date events.
  const nextYear = new Date().getFullYear() + 1;
  for (const key of ['museum-night', 'heritage-days'] as const) {
    if (eventDatesForYear(events, key, nextYear).estimated) {
      console.warn(`! events.json has no confirmed ${key} dates for ${nextYear} — check the official announcements.`);
    }
  }

  console.log(
    `\n${parsed.entries.length} scraped entries, ${changed} museum(s) with rule changes, ${unmatched.length} unmatched.`,
  );

  if (dryRun) {
    console.log('Dry run — nothing written.');
    return;
  }
  const tmp = `${MUSEUMS_PATH}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(museums, null, 2)}\n`);
  renameSync(tmp, MUSEUMS_PATH);
  console.log(`Wrote ${MUSEUMS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
