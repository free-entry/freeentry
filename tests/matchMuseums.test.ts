import { describe, expect, it } from 'vitest';
import type { Museum } from '@/lib/types';
import { matchMuseum, normalizeName } from '../scripts/lib/matchMuseums';

function museum(id: string, name: string): Museum {
  return {
    id,
    name,
    coordinates: [2.35, 48.85],
    address: 'x',
    postalCode: '75001',
    commune: 'Paris',
    department: '75',
    tags: [],
    freeAccess: [],
  };
}

const MUSEUMS = [
  museum('musee-d-art-moderne-de-paris', "Musée d'Art moderne de Paris"),
  museum('musee-carnavalet', 'Musée Carnavalet - Histoire de Paris'),
  museum('musee-du-louvre', 'Musée du Louvre'),
  museum('petit-palais', 'Petit Palais - Musée des Beaux-Arts de la ville de Paris'),
];

describe('normalizeName', () => {
  it('strips accents, punctuation and museum stopwords', () => {
    expect(normalizeName("Musée d'Art Moderne de Paris")).toBe('art moderne paris');
    expect(normalizeName('MUSÉE CARNAVALET — Histoire de Paris')).toBe(
      'carnavalet histoire paris',
    );
  });
});

describe('matchMuseum', () => {
  it('matches an exact name', () => {
    expect(matchMuseum('Musée du Louvre', MUSEUMS, {})?.id).toBe('musee-du-louvre');
  });
  it('matches despite case/accents/punctuation differences', () => {
    expect(matchMuseum("musee d'art moderne de Paris", MUSEUMS, {})?.id).toBe(
      'musee-d-art-moderne-de-paris',
    );
  });
  it('matches a shortened name via containment', () => {
    expect(matchMuseum('Petit Palais', MUSEUMS, {})?.id).toBe('petit-palais');
  });
  it('resolves via the alias table', () => {
    const aliases = { 'Le Louvre en majesté': 'musee-du-louvre' };
    expect(matchMuseum('Le Louvre en majesté', MUSEUMS, aliases)?.id).toBe('musee-du-louvre');
  });
  it('returns null for unknown names', () => {
    expect(matchMuseum('Musée Imaginaire', MUSEUMS, {})).toBeNull();
  });
});
