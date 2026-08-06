import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import museumsJson from '../../data/museums.json';
import eventsJson from '../../data/events.json';
import type { EventDates, Museum } from '@/lib/types';
import type { RuleContext } from '@/lib/freeRules';
import { applyFilters, DEFAULT_FILTERS, type FilterState } from '@/lib/filters';
import { decodeFilters, encodeFilters } from '@/lib/urlState';
import { haversineKm } from '@/lib/distance';
import { useMuseumContent, type MuseumContentMap } from '@/lib/localeData';

const MUSEUMS = museumsJson as unknown as Museum[];
const EVENTS = eventsJson as unknown as EventDates;

export interface AppStateValue {
  museums: Museum[];
  /** Filtered AND sorted (by distance when a center is set, else by name). */
  results: Museum[];
  filters: FilterState;
  setFilters: (update: FilterState | ((prev: FilterState) => FilterState)) => void;
  resetFilters: () => void;
  selected: Museum | null;
  select: (id: string | null) => void;
  ctx: RuleContext;
  content: MuseumContentMap;
  localizedNames: Record<string, string>;
  today: string;
  /** Geolocation result, [lng, lat]. */
  userLocation: [number, number] | null;
  setUserLocation: (loc: [number, number] | null) => void;
  /** True while the user is choosing a distance-filter center on the map. */
  pickingCenter: boolean;
  setPickingCenter: (picking: boolean) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // The provider sits above the routed pages, so the selected museum is
  // parsed from the (basename-relative) pathname rather than useParams.
  const routeId = useMemo(() => {
    const match = location.pathname.match(/^\/museum\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);

  const [filters, setFiltersState] = useState<FilterState>(() =>
    decodeFilters(new URLSearchParams(window.location.search)),
  );
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [pickingCenter, setPickingCenter] = useState(false);
  const today = useRef(localToday()).current;

  // Filters live in the URL so every view is shareable. `lang` is owned by
  // i18next; it must survive filter updates.
  const syncUrl = useCallback((next: FilterState) => {
    const params = encodeFilters(next);
    const lang = new URLSearchParams(window.location.search).get('lang');
    if (lang) params.set('lang', lang);
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
  }, []);

  const setFilters = useCallback(
    (update: FilterState | ((prev: FilterState) => FilterState)) => {
      setFiltersState((prev) => {
        const next = typeof update === 'function' ? update(prev) : update;
        syncUrl(next);
        return next;
      });
    },
    [syncUrl],
  );

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [setFilters]);

  const select = useCallback(
    (id: string | null) => {
      const query = window.location.search;
      navigate(id ? `/museum/${id}${query}` : `/${query}`);
    },
    [navigate],
  );

  // Browser back/forward restores filter state encoded in the URL.
  useEffect(() => {
    setFiltersState(decodeFilters(new URLSearchParams(location.search)));
  }, [location.search]);

  const ctx = useMemo<RuleContext>(
    () => ({ events: EVENTS, under26: filters.under26 }),
    [filters.under26],
  );

  const content = useMuseumContent(i18n.language);

  const localizedNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const [id, entry] of Object.entries(content)) {
      if (entry.name) names[id] = entry.name;
    }
    return names;
  }, [content]);

  const results = useMemo(() => {
    const filtered = applyFilters(MUSEUMS, filters, ctx, localizedNames);
    const collator = new Intl.Collator(i18n.language);
    const center = filters.center;
    return [...filtered].sort((a, b) => {
      if (center) {
        return haversineKm(center, a.coordinates) - haversineKm(center, b.coordinates);
      }
      return collator.compare(localizedNames[a.id] ?? a.name, localizedNames[b.id] ?? b.name);
    });
  }, [filters, ctx, localizedNames, i18n.language]);

  const selected = useMemo(
    () => (routeId ? (MUSEUMS.find((m) => m.id === routeId) ?? null) : null),
    [routeId],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      museums: MUSEUMS,
      results,
      filters,
      setFilters,
      resetFilters,
      selected,
      select,
      ctx,
      content,
      localizedNames,
      today,
      userLocation,
      setUserLocation,
      pickingCenter,
      setPickingCenter,
    }),
    [
      results,
      filters,
      setFilters,
      resetFilters,
      selected,
      select,
      ctx,
      content,
      localizedNames,
      today,
      userLocation,
      pickingCenter,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
