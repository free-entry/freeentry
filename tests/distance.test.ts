import { describe, expect, it } from 'vitest';
import { haversineKm } from '@/lib/distance';

describe('haversineKm', () => {
  it('measures Paris center to Château de Versailles at ~18 km', () => {
    const paris: [number, number] = [2.3522, 48.8566];
    const versailles: [number, number] = [2.1204, 48.8049];
    expect(haversineKm(paris, versailles)).toBeGreaterThan(17.4);
    expect(haversineKm(paris, versailles)).toBeLessThan(18.6);
  });
  it('is zero for identical points', () => {
    expect(haversineKm([2.35, 48.85], [2.35, 48.85])).toBe(0);
  });
  it('is symmetric', () => {
    const a: [number, number] = [2.35, 48.85];
    const b: [number, number] = [2.44, 48.83];
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});
