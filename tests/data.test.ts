import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EventDates, Museum } from '@/lib/types';
import { COUNTRIES } from '../src/countries';

const DATA_DIR = join(__dirname, '../data');
const countryCodes = readdirSync(DATA_DIR).filter((d) =>
  existsSync(join(DATA_DIR, d, 'museums.json')),
);
/** Minimum dataset sizes per country (guards against truncated writes). */
const MIN_VENUES: Record<string, number> = { fr: 200 };

describe.each(countryCodes)('country %s', (cc) => {
  const config = COUNTRIES[cc];
  const museums = JSON.parse(
    readFileSync(join(DATA_DIR, cc, 'museums.json'), 'utf-8'),
  ) as Museum[];
  const events = JSON.parse(
    readFileSync(join(DATA_DIR, cc, 'events.json'), 'utf-8'),
  ) as EventDates;
  const DEPARTMENTS = Object.keys(config.adminAreas.names);
const KINDS = ['always', 'nth-weekday', 'weekly', 'event', 'annual-date'];
const AUDIENCES = ['everyone', 'under-26-eu', 'under-18', 'residents'];
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

describe('museums.json integrity', () => {
  it('has a substantial dataset', () => {
    expect(config, `no country config registered for ${cc}`).toBeDefined();
    const min = MIN_VENUES[cc] ?? 10;
    expect(museums.length).toBeGreaterThan(min);
    expect(museums.filter((m) => m.freeAccess.length > 0).length).toBeGreaterThan(min / 2);
  });

  it('has unique, well-formed ids', () => {
    const ids = museums.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('keeps every museum inside the country bbox', () => {
    for (const m of museums) {
      const [lng, lat] = m.coordinates;
      expect(lat, m.id).toBeGreaterThan(config.bbox.minLat);
      expect(lat, m.id).toBeLessThan(config.bbox.maxLat);
      expect(lng, m.id).toBeGreaterThan(config.bbox.minLng);
      expect(lng, m.id).toBeLessThan(config.bbox.maxLng);
    }
  });

  it('has consistent departments, postal codes and arrondissements', () => {
    for (const m of museums) {
      expect(DEPARTMENTS, m.id).toContain(m.department);
      expect(m.postalCode, m.id).toMatch(config.adminAreas.postalPrefix(m.department));
      const arrMax = config.adminAreas.districtRanges[m.department];
      if (m.arrondissement !== undefined) {
        expect(arrMax, `${m.id}: arrondissement outside an arrondissement city`).toBeDefined();
        expect(m.arrondissement, m.id).toBeGreaterThanOrEqual(1);
        expect(m.arrondissement, m.id).toBeLessThanOrEqual(arrMax);
      } else if (m.department === '75') {
        expect(m.arrondissement, m.id).toBeDefined();
      }
    }
  });

  it('has well-formed rules with verifiable sources', () => {
    for (const m of museums) {
      for (const rule of m.freeAccess) {
        expect(KINDS, m.id).toContain(rule.kind);
        expect(rule.source.url, m.id).toMatch(/^https?:\/\//);
        expect(rule.source.checkedAt, m.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        if (rule.audience) expect(AUDIENCES, m.id).toContain(rule.audience);
        if (rule.kind === 'nth-weekday') {
          expect(WEEKDAYS, m.id).toContain(rule.weekday);
          expect([1, -1], m.id).toContain(rule.nth);
        }
        if (rule.kind === 'weekly') expect(WEEKDAYS, m.id).toContain(rule.weekday);
        if (rule.kind === 'annual-date') expect(rule.date, m.id).toMatch(/^\d{2}-\d{2}$/);
        if (rule.kind === 'event') {
          expect(rule.event && events[rule.event], m.id).toBeTruthy();
        }
        if (rule.months) {
          expect(rule.months.length, m.id).toBeGreaterThan(0);
          for (const month of rule.months) {
            expect(month, m.id).toBeGreaterThanOrEqual(1);
            expect(month, m.id).toBeLessThanOrEqual(12);
          }
        }
      }
    }
  });

  it('pairs opening hours with a dated source', () => {
    for (const m of museums) {
      if (m.openingHours) {
        expect(m.openingHours.trim(), m.id).not.toBe('');
        expect(m.openingHoursSource?.url, m.id).toMatch(/^https?:\/\//);
        expect(m.openingHoursSource?.checkedAt, m.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        expect(m.openingHoursSource, m.id).toBeUndefined();
      }
    }
  });

  it('has well-formed, unique Wikidata links', () => {
    const qids = museums.filter((m) => m.wikidata).map((m) => m.wikidata as string);
    expect(new Set(qids).size).toBe(qids.length);
    for (const m of museums) {
      if (m.wikidata) expect(m.wikidata, m.id).toMatch(/^Q\d+$/);
      if (m.wikipedia) {
        // Canonical-language article; nl fills in for Flemish venues without one.
        expect(m.wikipedia, m.id).toMatch(/^https:\/\/(fr|it|nl)\.wikipedia\.org\/wiki\/./);
        // A Wikipedia link without its Wikidata item means enrichment went wrong.
        expect(m.wikidata, m.id).toBeDefined();
      }
    }
  });

  it('has well-formed image metadata for museums that have one', () => {
    const ALLOWED_LICENSE = /^(CC0 1\.0|Public Domain|CC BY(-SA)? \d\.\d)$/;
    for (const m of museums) {
      if (!m.image) continue;
      expect(m.image.file, m.id).toMatch(/^images\/museums\/[a-z0-9-]+\.jpg$/);
      expect(m.image.author.trim(), m.id).not.toBe('');
      expect(m.image.license, m.id).toMatch(ALLOWED_LICENSE);
      expect(m.image.sourceUrl, m.id).toMatch(/^https?:\/\//);
      const onDisk = join(__dirname, '..', 'public', m.image.file);
      expect(existsSync(onDisk), `${m.id}: ${m.image.file} missing under public/`).toBe(true);
    }
  });

  it('contains no leftover placeholder values', () => {
    const raw = JSON.stringify(museums);
    expect(raw).not.toContain('"undefined"');
    expect(raw).not.toContain('TODO');
  });

  it('has confirmed event dates matching their year keys', () => {
    for (const calendar of Object.values(events)) {
      for (const [year, dates] of Object.entries(calendar.confirmed)) {
        expect(dates.length).toBeGreaterThan(0);
        for (const date of dates) expect(date.startsWith(year)).toBe(true);
      }
    }
  });
});
});
