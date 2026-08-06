import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { GeolocateControl, Map as MlMap, NavigationControl, Popup, ScaleControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import { CATEGORY_COLORS, deriveCategory } from '@/lib/categories';
import type { Museum } from '@/lib/types';
import MapLegend from './MapLegend';
import styles from './MapView.module.css';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/** Île-de-France framing. */
const DEFAULT_CENTER: [number, number] = [2.42, 48.78];
const DEFAULT_ZOOM = 9.2;
const TEXT_FONT = ['Noto Sans Regular'];

// Copied from @mapbox/mapbox-gl-rtl-text on postinstall (see scripts/copy-rtl-plugin.mjs).
const RTL_PLUGIN_URL = `${import.meta.env.BASE_URL}vendor/mapbox-gl-rtl-text.js`;

let rtlPluginRequested = false;
function ensureRtlPlugin() {
  if (rtlPluginRequested) return;
  rtlPluginRequested = true;
  // Lazy: the worker loads only when a right-to-left label actually appears.
  void maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, true);
}

function museumsToGeoJSON(museums: Museum[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: museums.map((m) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: m.coordinates },
      properties: { id: m.id, name: m.name, category: deriveCategory(m) },
    })),
  };
}

/** 64-segment circle polygon around [lng, lat] with radius in km. */
function circlePolygon(center: [number, number], radiusKm: number): GeoJSON.Feature {
  const points: [number, number][] = [];
  const latRad = (center[1] * Math.PI) / 180;
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * 2 * Math.PI;
    points.push([
      center[0] + ((radiusKm / 111.32) * Math.cos(angle)) / Math.cos(latRad),
      center[1] + (radiusKm / 110.57) * Math.sin(angle),
    ]);
  }
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [points] },
    properties: {},
  };
}

function categoryColorExpression(): maplibregl.ExpressionSpecification {
  const pairs = Object.entries(CATEGORY_COLORS).flatMap(([category, color]) => [category, color]);
  return ['match', ['get', 'category'], ...pairs, CATEGORY_COLORS.none] as never;
}

function readHash(): { center: [number, number]; zoom: number } | null {
  const match = window.location.hash.match(/#map=([\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)/);
  if (!match) return null;
  const [, zoom, lat, lng] = match.map(Number);
  if (![zoom, lat, lng].every(Number.isFinite)) return null;
  return { center: [lng, lat], zoom };
}

export default function MapView() {
  const { t } = useTranslation();
  const {
    results,
    selected,
    select,
    filters,
    setFilters,
    pickingCenter,
    setPickingCenter,
    localizedNames,
  } = useAppState();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const loadedRef = useRef(false);
  const hoverPopupRef = useRef<Popup | null>(null);

  // Refs so map event handlers installed once always see current state.
  const stateRef = useRef({ results, select, selected, pickingCenter, setPickingCenter, setFilters, localizedNames });
  stateRef.current = { results, select, selected, pickingCenter, setPickingCenter, setFilters, localizedNames };

  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureRtlPlugin();

    const initial = readHash();
    const map = new MlMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: initial?.center ?? DEFAULT_CENTER,
      zoom: initial?.zoom ?? DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (import.meta.env.DEV) {
      (window as unknown as { __map: MlMap; __mapErrors: unknown[] }).__map = map;
      const errors: unknown[] = [];
      (window as unknown as { __mapErrors: unknown[] }).__mapErrors = errors;
      map.on('error', (e) => errors.push(String((e as { error?: Error }).error ?? e)));
    }

    map.addControl(new NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(
      new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      'top-right',
    );
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    map.on('load', () => {
      loadedRef.current = true;

      map.addSource('museums', {
        type: 'geojson',
        data: museumsToGeoJSON(stateRef.current.results),
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 46,
        promoteId: 'id',
      });
      map.addSource('radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius',
        paint: { 'fill-color': '#1D4E79', 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: 'radius',
        paint: { 'line-color': '#1D4E79', 'line-width': 1.5, 'line-dasharray': [2, 2] },
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'museums',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#1D4E79',
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 30, 23],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'museums',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': TEXT_FONT,
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'museum-points',
        type: 'circle',
        source: 'museums',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': categoryColorExpression(),
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            ['case', ['==', ['get', 'category'], 'none'], 3.5, 5],
            13,
            ['case', ['==', ['get', 'category'], 'none'], 6, 8],
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': ['case', ['==', ['get', 'category'], 'none'], 0.6, 0.95],
        },
      });
      map.addLayer({
        id: 'museum-selected',
        type: 'circle',
        source: 'museums',
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-color': categoryColorExpression(),
          'circle-radius': 11,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#20242C',
        },
      });

      map.on('click', 'clusters', (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
        const clusterId = feature.properties?.cluster_id as number;
        const source = map.getSource('museums') as maplibregl.GeoJSONSource;
        void source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        });
      });

      map.on('click', 'museum-points', (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) stateRef.current.select(id);
      });

      // Distance-filter center picking: one click anywhere sets the center.
      map.on('click', (e) => {
        if (!stateRef.current.pickingCenter) return;
        const center: [number, number] = [
          Number(e.lngLat.lng.toFixed(5)),
          Number(e.lngLat.lat.toFixed(5)),
        ];
        stateRef.current.setFilters((prev) => ({
          ...prev,
          center,
          radiusKm: prev.radiusKm ?? 5,
        }));
        stateRef.current.setPickingCenter(false);
      });

      for (const layer of ['clusters', 'museum-points']) {
        map.on('mouseenter', layer, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layer, () => {
          map.getCanvas().style.cursor = stateRef.current.pickingCenter ? 'crosshair' : '';
        });
      }

      // Hover tooltip with name + localized name.
      map.on('mousemove', 'museum-points', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const id = feature.properties?.id as string;
        const name = feature.properties?.name as string;
        const localized = stateRef.current.localizedNames[id];
        const label = localized && localized !== name ? `${localized}<br><small>${name}</small>` : name;
        if (!hoverPopupRef.current) {
          hoverPopupRef.current = new Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 14,
            className: 'museum-hover-popup',
          });
        }
        hoverPopupRef.current
          .setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(label)
          .addTo(map);
      });
      map.on('mouseleave', 'museum-points', () => {
        hoverPopupRef.current?.remove();
      });

      // Deep links (/museum/<id>) select before the style is ready — apply now.
      const initialSelected = stateRef.current.selected;
      if (initialSelected) {
        map.setFilter('museum-selected', ['==', ['get', 'id'], initialSelected.id]);
        map.jumpTo({ center: initialSelected.coordinates, zoom: Math.max(map.getZoom(), 13.5) });
      }
    });

    // Persist position in the hash for shareable/restorable map views.
    map.on('moveend', () => {
      const center = map.getCenter();
      const hash = `#map=${map.getZoom().toFixed(2)}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hash}`);
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      hoverPopupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the museums source in sync with filter results.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const apply = () => {
      (map.getSource('museums') as maplibregl.GeoJSONSource | undefined)?.setData(
        museumsToGeoJSON(results),
      );
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [results]);

  // Radius circle for the distance filter.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource('radius') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(
      filters.center && filters.radiusKm !== null
        ? { type: 'FeatureCollection', features: [circlePolygon(filters.center, filters.radiusKm)] }
        : { type: 'FeatureCollection', features: [] },
    );
  }, [filters.center, filters.radiusKm]);

  // Selection: highlight + fly to.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setFilter('museum-selected', ['==', ['get', 'id'], selected?.id ?? '']);
    if (selected) {
      const target = {
        center: selected.coordinates,
        zoom: Math.max(map.getZoom(), 13.5),
      };
      if (prefersReducedMotion) map.jumpTo(target);
      else map.flyTo({ ...target, duration: 900 });
    }
  }, [selected, prefersReducedMotion]);

  // Crosshair cursor while picking a distance center.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickingCenter ? 'crosshair' : '';
  }, [pickingCenter]);

  return (
    <div className={styles.wrapper}>
      <div
        ref={containerRef}
        className={styles.map}
        role="application"
        aria-label={t('map.ariaLabel')}
      />
      {pickingCenter && (
        <p className={styles.pickHint} role="status">
          {t('filters.pickOnMapHint')}
        </p>
      )}
      <MapLegend />
      <span className="sr-only" aria-live="polite">
        {selected ? t('a11y.selectedMarker', { name: localizedNames[selected.id] ?? selected.name }) : ''}
      </span>
    </div>
  );
}
