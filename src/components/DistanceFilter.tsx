import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import { formatKm } from '@/lib/format';
import styles from './DistanceFilter.module.css';

/** Log-scale slider position (0–100) ⇄ kilometres (0.5–100). */
const MIN_KM = 0.5;
const MAX_KM = 100;
function positionToKm(position: number): number {
  const km = MIN_KM * Math.pow(MAX_KM / MIN_KM, position / 100);
  return km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
}
function kmToPosition(km: number): number {
  return (100 * Math.log(km / MIN_KM)) / Math.log(MAX_KM / MIN_KM);
}

interface DistanceFilterProps {
  /** Close the surrounding dialog so the user can see the map while picking. */
  onPickOnMap: () => void;
}

export default function DistanceFilter({ onPickOnMap }: DistanceFilterProps) {
  const { t, i18n } = useTranslation();
  const { filters, setFilters, setUserLocation, setPickingCenter } = useAppState();
  const [geoError, setGeoError] = useState(false);

  const radius = filters.radiusKm ?? 5;

  function useMyLocation() {
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center: [number, number] = [
          Number(pos.coords.longitude.toFixed(5)),
          Number(pos.coords.latitude.toFixed(5)),
        ];
        setUserLocation(center);
        setFilters((prev) => ({ ...prev, center, radiusKm: prev.radiusKm ?? 5 }));
      },
      () => setGeoError(true),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  function clear() {
    setFilters((prev) => ({ ...prev, center: null, radiusKm: null }));
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.buttons}>
        <button type="button" className={styles.action} onClick={useMyLocation}>
          {t('filters.useMyLocation')}
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            setPickingCenter(true);
            onPickOnMap();
          }}
        >
          {t('filters.pickOnMap')}
        </button>
      </div>
      {geoError && (
        <p className={styles.error} role="alert">
          {t('filters.locationDenied')}
        </p>
      )}
      {filters.center && (
        <>
          <label className={styles.sliderLabel}>
            {t('filters.radius')}: <strong>{formatKm(i18n.language, radius)}</strong>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={kmToPosition(radius)}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, radiusKm: positionToKm(Number(e.target.value)) }))
              }
            />
          </label>
          <button
            type="button"
            className={styles.clear}
            onClick={clear}
            aria-label={t('filters.removeFilter', {
              label: t('filters.withinKm', { km: radius }),
            })}
          >
            ✕ {t('filters.withinKm', { km: radius })}
          </button>
        </>
      )}
    </div>
  );
}
