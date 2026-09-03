import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatOpeningHours, parseOpeningHours } from '../src/lib/openingHours';
import type { Museum } from '@/lib/types';

const museums = JSON.parse(
  readFileSync(join(__dirname, '../data/fr/museums.json'), 'utf-8'),
) as Museum[];
const labels = { closed: 'closed', publicHolidays: 'public holidays', always: 'Open 24/7' };
const labelsFr = { closed: 'fermé', publicHolidays: 'jours fériés', always: 'Ouvert 24h/24' };

describe('formatOpeningHours', () => {
  it('renders every stored opening-hours string (no raw fallback)', () => {
    for (const m of museums) {
      if (!m.openingHours) continue;
      const out = formatOpeningHours(m.openingHours, 'en', labels);
      expect(out, `${m.id}: ${m.openingHours}`).not.toBe(m.openingHours);
      expect(out.trim(), m.id).not.toBe('');
    }
  });

  it('localizes weekday and month names', () => {
    expect(formatOpeningHours('Tu-Su 10:00-18:00', 'fr', labelsFr)).toBe('mar.–dim. 10:00-18:00');
    expect(formatOpeningHours('Apr-Sep 10:00-23:00; Oct-Mar 10:00-22:30', 'fr', labelsFr)).toBe(
      'avr.–sept. 10:00-23:00 · oct.–mars 10:00-22:30',
    );
    expect(formatOpeningHours('Mo,We-Fr 10:00-13:00,14:00-18:00', 'zh-Hans', labels)).toBe(
      '周一, 周三–周五 10:00-13:00, 14:00-18:00',
    );
  });

  it('handles PH, off and 24/7', () => {
    expect(formatOpeningHours('Mo-Sa 09:00-16:45; PH off', 'fr', labelsFr)).toBe(
      'lun.–sam. 09:00-16:45 · jours fériés fermé',
    );
    expect(formatOpeningHours('24/7', 'fr', labelsFr)).toBe('Ouvert 24h/24');
    expect(formatOpeningHours('Tu off', 'fr', labelsFr)).toBe('mar. fermé');
  });

  it('falls back to the raw string when a rule is unparseable', () => {
    expect(formatOpeningHours('Tu-Su sunrise-sunset', 'fr', labelsFr)).toBe('Tu-Su sunrise-sunset');
  });
});

describe('parseOpeningHours', () => {
  it('expands day ranges and emits one specification per time range', () => {
    const parsed = parseOpeningHours('Mo,We-Fr 10:00-13:00,14:00-18:00');
    expect(parsed).toHaveLength(2);
    expect(parsed?.[0]).toEqual({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'https://schema.org/Monday',
        'https://schema.org/Wednesday',
        'https://schema.org/Thursday',
        'https://schema.org/Friday',
      ],
      opens: '10:00',
      closes: '13:00',
    });
    expect(parsed?.[1]).toMatchObject({ opens: '14:00', closes: '18:00' });
  });

  it('skips public-holiday and closed rules', () => {
    expect(parseOpeningHours('Mo-Sa 09:00-16:45; PH off')).toHaveLength(1);
    expect(parseOpeningHours('Tu off; PH 10:00-12:00')).toEqual([]);
  });

  it('handles 24/7 and rejects month-limited or invalid strings', () => {
    expect(parseOpeningHours('24/7')?.[0]).toMatchObject({ opens: '00:00', closes: '23:59' });
    expect(parseOpeningHours('Apr-Sep Tu-Su 10:00-18:00')).toBeNull();
    expect(parseOpeningHours('Tu-Su sunrise-sunset')).toBeNull();
  });
});
