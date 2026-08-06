import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/state/AppState';
import type { Department } from '@/lib/types';
import { DEPARTMENT_NAMES } from '@/lib/departments';
import { searchFold } from '@/lib/filters';
import styles from './AreaFilter.module.css';

const ARRONDISSEMENTS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function AreaFilter() {
  const { t } = useTranslation();
  const { museums, filters, setFilters } = useAppState();
  const [communeQuery, setCommuneQuery] = useState('');

  // Only departments the dataset actually covers.
  const departments = useMemo(
    () => [...new Set(museums.map((m) => m.department))].sort((a, b) => a.localeCompare(b, 'fr')),
    [museums],
  );

  const allCommunes = useMemo(
    () => [...new Set(museums.map((m) => m.commune))].sort((a, b) => a.localeCompare(b, 'fr')),
    [museums],
  );

  const communeSuggestions = useMemo(() => {
    const q = searchFold(communeQuery);
    if (!q) return [];
    return allCommunes
      .filter((c) => searchFold(c).includes(q) && !filters.communes.includes(c))
      .slice(0, 8);
  }, [communeQuery, allCommunes, filters.communes]);

  function toggleDepartment(dep: Department) {
    setFilters((prev) => ({
      ...prev,
      departments: prev.departments.includes(dep)
        ? prev.departments.filter((d) => d !== dep)
        : [...prev.departments, dep],
    }));
  }

  function toggleArrondissement(n: number) {
    setFilters((prev) => ({
      ...prev,
      arrondissements: prev.arrondissements.includes(n)
        ? prev.arrondissements.filter((a) => a !== n)
        : [...prev.arrondissements, n],
    }));
  }

  function addCommune(commune: string) {
    setFilters((prev) => ({ ...prev, communes: [...prev.communes, commune] }));
    setCommuneQuery('');
  }

  function removeCommune(commune: string) {
    setFilters((prev) => ({ ...prev, communes: prev.communes.filter((c) => c !== commune) }));
  }

  return (
    <div className={styles.wrapper}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('filters.departments')}</legend>
        <ul className={styles.departmentList}>
          {departments.map((dep) => (
            <li key={dep}>
              <label className={styles.departmentItem}>
                <input
                  type="checkbox"
                  checked={filters.departments.includes(dep)}
                  onChange={() => toggleDepartment(dep)}
                />
                <span className={styles.depCode}>{dep}</span> {DEPARTMENT_NAMES[dep]}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('filters.arrondissements')}</legend>
        <div className={styles.arrGrid} role="group">
          {ARRONDISSEMENTS.map((n) => (
            <button
              key={n}
              type="button"
              className={styles.arrButton}
              aria-pressed={filters.arrondissements.includes(n)}
              aria-label={t('filters.arrondissementLabel', { number: n })}
              onClick={() => toggleArrondissement(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{t('filters.communes')}</legend>
        {filters.communes.length > 0 && (
          <ul className={styles.communeChips}>
            {filters.communes.map((commune) => (
              <li key={commune}>
                <button
                  type="button"
                  className={styles.communeChip}
                  aria-label={t('filters.removeFilter', { label: commune })}
                  onClick={() => removeCommune(commune)}
                >
                  {commune} ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          type="text"
          className={styles.communeInput}
          placeholder={t('filters.communesSearch')}
          aria-label={t('filters.communesSearch')}
          value={communeQuery}
          onChange={(e) => setCommuneQuery(e.target.value)}
        />
        {communeSuggestions.length > 0 && (
          <ul className={styles.suggestions}>
            {communeSuggestions.map((commune) => (
              <li key={commune}>
                <button type="button" className={styles.suggestion} onClick={() => addCommune(commune)}>
                  {commune}
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </div>
  );
}
