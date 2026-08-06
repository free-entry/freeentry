/**
 * Diffs our dataset against the Centre des monuments nationaux official
 * monument list (monuments-nationaux.fr/trouver-un-monument). Report-only:
 * new monuments on the list are candidates to add (via build-cmn + the
 * AI-assisted verification pass), and venues of ours whose CMN site vanished
 * from the list deserve a closure check.
 *
 * Identity key: the monument's own website host — every CMN site has one.
 *
 * Usage: npx tsx scripts/check-cmn.ts [--fixture]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Museum } from '../src/lib/types';

const ROOT = join(import.meta.dirname, '..');
const LIST_URL = 'https://www.monuments-nationaux.fr/trouver-un-monument';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function parseList(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const pattern = /<a[^>]+href="(https:\/\/www\.[a-z0-9-]+\.fr)\/?"[^>]*>(.*?)<\/a>/gs;
  for (const [, url, inner] of html.matchAll(pattern)) {
    if (url.includes('monuments-nationaux.fr')) continue;
    const text = inner
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&amp;/g, '&')
      .replace(/&#x27;|&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    const existing = out.get(url);
    if (!existing || text.length > existing.length) out.set(url, text);
  }
  return out;
}

async function loadList(useFixture: boolean): Promise<Map<string, string>> {
  if (useFixture) {
    const fixture: Record<string, string> = JSON.parse(
      readFileSync(join(import.meta.dirname, 'fixtures/cmn-monuments.json'), 'utf-8'),
    );
    return new Map(Object.entries(fixture));
  }
  const res = await fetch(LIST_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const list = parseList(await res.text());
  if (list.size < 80) {
    throw new Error(`Only ${list.size} monuments parsed — the page layout probably changed; aborting.`);
  }
  return list;
}

async function main() {
  const useFixture = process.argv.includes('--fixture');
  const museums: Museum[] = JSON.parse(readFileSync(join(ROOT, 'data/museums.json'), 'utf-8'));
  const list = await loadList(useFixture);

  const ourHosts = new Map(
    museums
      .map((m) => [m.website ? hostname(m.website) : null, m] as const)
      .filter((pair): pair is [string, Museum] => pair[0] !== null),
  );
  const listHosts = new Set([...list.keys()].map((u) => hostname(u)).filter(Boolean));

  const newOnList = [...list.entries()].filter(([url]) => !ourHosts.has(hostname(url) as string));
  // A venue counts as CMN when a free rule cites the CMN ticketing pages or
  // its own official site (the per-site verification pass writes those).
  const goneFromList = museums.filter(
    (m) =>
      m.tags.includes('monument') &&
      m.website !== undefined &&
      !listHosts.has(hostname(m.website) as string) &&
      m.freeAccess.some(
        (r) =>
          r.source.url.includes('monuments-nationaux.fr') ||
          hostname(r.source.url) === hostname(m.website as string),
      ),
  );

  console.log(`CMN list: ${list.size} monuments — ${newOnList.length} not in our dataset.`);
  if (newOnList.length) {
    console.log('\nOn the official list but not here (run build-cmn + the AI verification pass):');
    for (const [url, name] of newOnList) console.log(`  ? ${name} <${url}>`);
  }
  if (goneFromList.length) {
    console.log('\nOur CMN venues missing from the current list (check for closure/transfer):');
    for (const m of goneFromList) console.log(`  ~ ${m.id} <${m.website}>`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
