import styles from './AdminOverview.module.css';

const timestamp = value => value
  ? new Date(value).toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      dateStyle: 'medium',
      timeStyle: 'short',
    }) + ' WITA'
  : '—';

export function DataSourceStatus({ response }) {
  const label = response?.source === 'offline' ? 'Salinan offline' : 'Data diterima server';

  return (
    <div className={styles.sourceStatus} aria-label={`${label}. Diperbarui ${timestamp(response?.updatedAt)}`}>
      <span className={styles.sourceLabel}>{label}</span>
      <span className={styles.sourceTime}>Diperbarui {timestamp(response?.updatedAt)}</span>
    </div>
  );
}

export function ChartLegend() {
  return (
    <div className={styles.chartLegend} aria-label="Keterangan grafik">
      <span><i className={`${styles.legendDot} ${styles.legendIncoming}`} aria-hidden="true" />Timbulan</span>
      <span><i className={`${styles.legendDot} ${styles.legendTransported}`} aria-hidden="true" />Diangkut</span>
      <span className={styles.chartHint}>Sentuh batang untuk melihat nilai</span>
    </div>
  );
}
