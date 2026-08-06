import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseArticle, type ParsedArticle } from '../scripts/lib/parseArticle';

let parsed: ParsedArticle;

beforeAll(() => {
  const html = readFileSync(join(__dirname, '../scripts/fixtures/fr/parisjetaime.html'), 'utf-8');
  parsed = parseArticle(html);
});

function names(sectionKey: string): string[] {
  return parsed.entries.filter((e) => e.sectionKey === sectionKey).map((e) => e.name);
}

describe('parseArticle', () => {
  it('finds all eight free-access sections', () => {
    expect(parsed.sections.sort()).toEqual(
      [
        'always',
        'first-sunday',
        'first-sunday-oct-mar',
        'first-sunday-nov-mar',
        'first-saturday-oct-jun',
        'nocturne',
        'july-14',
        'under-26',
      ].sort(),
    );
  });

  it('lists city museums in the always-free section', () => {
    expect(names('always')).toContain('Musée Carnavalet - Histoire de Paris');
    expect(names('always')).toContain('Petit Palais - Musée des Beaux-Arts de la ville de Paris');
  });

  it('lists national museums in the first-sunday section', () => {
    expect(names('first-sunday')).toContain("Musée d'Orsay");
    expect(names('first-sunday')).toContain("Musée de l'Orangerie");
  });

  it('lists Musée Rodin Paris in the Oct–Mar section', () => {
    expect(names('first-sunday-oct-mar')).toContain('Musée Rodin Paris');
  });

  it('lists monuments in the Nov–Mar section', () => {
    expect(names('first-sunday-nov-mar')).toContain('Panthéon');
    expect(names('first-sunday-nov-mar')).toContain('Sainte-Chapelle');
  });

  it('lists the Louvre in nocturne, july-14 and under-26 sections', () => {
    expect(names('nocturne')).toContain('Musée du Louvre');
    expect(names('july-14')).toContain('Musée du Louvre');
    expect(names('under-26')).toContain('Musée du Louvre');
  });

  it('captures detail-page URLs', () => {
    const orsay = parsed.entries.find(
      (e) => e.name === "Musée d'Orsay" && e.sectionKey === 'first-sunday',
    );
    expect(orsay?.url).toMatch(/^https:\/\/parisjetaime\.com\//);
  });

  it('ignores FAQ, commercial offers and see-also sections', () => {
    const all = parsed.entries.map((e) => e.name).join('|');
    expect(all).not.toContain('Paris City Pass');
    expect(all).not.toContain('Visite guidée');
  });
});
