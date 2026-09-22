import styles from './MapLoading.module.css';

interface Props {
  loadingLabel?: string;
  browseLabel?: string;
  browseHref: string;
}

/** The same first paint before React loads and while the locale initializes. */
export default function MapLoading({ loadingLabel = 'Loading…', browseLabel = 'Browse museums', browseHref }: Props) {
  return (
    <div className={styles.shell} data-map-loading>
      <header className={styles.header}>Free Entry</header>
      <div className={styles.body}>
        <aside className={styles.sidebar} aria-hidden="true">
          <div className={styles.search} />
          {[0, 1, 2, 3].map((item) => <div key={item} className={styles.card}><span /><span /></div>)}
        </aside>
        <main className={styles.map}>
          <div className={styles.status} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            <span>{loadingLabel}</span>
          </div>
          <a className={styles.browse} href={browseHref}>{browseLabel}</a>
        </main>
      </div>
    </div>
  );
}
