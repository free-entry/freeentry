import * as cheerio from 'cheerio';

/** One museum/monument occurrence inside a free-access section. */
export interface ScrapedEntry {
  name: string;
  url?: string;
  sectionKey: string;
}

export interface ParsedArticle {
  entries: ScrapedEntry[];
  /** Section keys found on the page, in document order. */
  sections: string[];
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Maps an <h2> section heading to a stable section key, or null for
 * non-category sections (FAQ, commercial offers, see-also).
 */
export function sectionKeyForHeading(heading: string): string | null {
  const h = fold(heading);
  if (!h.includes('gratuit')) return null;
  if (h.includes('tous les jours')) return 'always';
  if (h.includes('1er dimanche')) {
    if (h.includes('novembre')) return 'first-sunday-nov-mar';
    if (h.includes('octobre')) return 'first-sunday-oct-mar';
    return 'first-sunday';
  }
  if (h.includes('1er samedi')) return 'first-saturday-oct-jun';
  if (h.includes('nocturne')) return 'nocturne';
  if (h.includes('14 juillet')) return 'july-14';
  if (h.includes('moins de 26 ans')) return 'under-26';
  return null;
}

/**
 * Extracts the free-access category sections and their museum cards from the
 * parisjetaime article. Museum cards are `<h3|h4 class="title">` headings
 * inside `.card` elements; plain sub-headings inside a section (e.g. the
 * "📌 …" list intros) carry no `.title` class and are skipped.
 */
export function parseArticle(html: string): ParsedArticle {
  const $ = cheerio.load(html);
  const entries: ScrapedEntry[] = [];
  const sections: string[] = [];
  let current: string | null = null;

  $('h2, h3.title, h4.title').each((_, el) => {
    const $el = $(el);
    if (el.tagName === 'h2') {
      current = sectionKeyForHeading($el.text().trim());
      if (current && !sections.includes(current)) sections.push(current);
      return;
    }
    if (!current) return;
    const link = $el.find('a').first();
    const name = ($el.text() || '').replace(/\s+/g, ' ').trim();
    if (!name) return;
    const href = link.attr('href');
    entries.push({
      name,
      url: href ? new URL(href, 'https://parisjetaime.com/').toString() : undefined,
      sectionKey: current,
    });
  });

  return { entries, sections };
}
