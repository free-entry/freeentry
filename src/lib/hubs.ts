import type { CountryConfig } from '@/countries';
import { CATEGORY_ORDER, deriveCategories, type Category } from './categories';
import { haversineKm } from './distance';
import type { Museum } from './types';

export interface AreaHub {
  code: string;
  name: string;
  slug: string;
  museums: Museum[];
  count: number;
}

export interface CityHub {
  name: string;
  areaCode: string;
  areaName: string;
  slug: string;
  museums: Museum[];
  count: number;
}

export interface CategoryHub {
  category: Exclude<Category, 'none'>;
  slug: string;
  museums: Museum[];
  count: number;
}

export interface HubIndex {
  areas: AreaHub[];
  cities: CityHub[];
  categories: CategoryHub[];
  cityPageExists: (commune: string, areaCode?: string) => boolean;
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildHubIndex(museums: Museum[], country: CountryConfig): HubIndex {
  const areaGroups = new Map<string, Museum[]>();
  const cityGroups = new Map<string, { name: string; areaCode: string; museums: Museum[] }>();

  for (const museum of museums) {
    const areaMuseums = areaGroups.get(museum.department) ?? [];
    areaMuseums.push(museum);
    areaGroups.set(museum.department, areaMuseums);

    const cityKey = `${museum.department}\u0000${museum.commune}`;
    const city = cityGroups.get(cityKey) ?? {
      name: museum.commune,
      areaCode: museum.department,
      museums: [],
    };
    city.museums.push(museum);
    cityGroups.set(cityKey, city);
  }

  const areas = [...areaGroups].map(([code, areaMuseums]) => ({
    code,
    name: country.adminAreas.names[code] ?? code,
    slug: slugify(country.adminAreas.names[code] ?? code),
    museums: areaMuseums,
    count: areaMuseums.length,
  }));

  const baseSlugCounts = new Map<string, number>();
  for (const city of cityGroups.values()) {
    const baseSlug = slugify(city.name);
    baseSlugCounts.set(baseSlug, (baseSlugCounts.get(baseSlug) ?? 0) + 1);
  }

  const cities = [...cityGroups.values()]
    .filter((city) => {
      const areaCount = areaGroups.get(city.areaCode)?.length ?? 0;
      return city.museums.length >= 2 && city.museums.length !== areaCount;
    })
    .map((city) => {
      const baseSlug = slugify(city.name);
      return {
        ...city,
        areaName: country.adminAreas.names[city.areaCode] ?? city.areaCode,
        slug:
          (baseSlugCounts.get(baseSlug) ?? 0) > 1
            ? `${baseSlug}-${city.areaCode.toLowerCase()}`
            : baseSlug,
        count: city.museums.length,
      };
    });

  const categories = CATEGORY_ORDER.filter(
    (category): category is Exclude<Category, 'none'> => category !== 'none',
  )
    .map((category) => {
      const categoryMuseums = museums.filter((museum) => deriveCategories(museum).includes(category));
      return {
        category,
        slug: category,
        museums: categoryMuseums,
        count: categoryMuseums.length,
      };
    })
    .filter((category) => category.count >= 3);

  return {
    areas,
    cities,
    categories,
    cityPageExists: (commune, areaCode) =>
      cities.some(
        (city) => city.name === commune && (areaCode === undefined || city.areaCode === areaCode),
      ),
  };
}

export function nearbyMuseums(museum: Museum, all: Museum[], n = 6): Museum[] {
  return all
    .map((candidate, index) => ({
      candidate,
      index,
      sameCommune:
        candidate.commune === museum.commune && candidate.department === museum.department,
      distance: haversineKm(museum.coordinates, candidate.coordinates),
    }))
    .filter(({ candidate }) => candidate.id !== museum.id)
    .sort((a, b) => {
      if (a.sameCommune !== b.sameCommune) return a.sameCommune ? -1 : 1;
      return a.distance - b.distance || a.index - b.index;
    })
    .slice(0, Math.max(0, n))
    .map(({ candidate }) => candidate);
}
