import { useCallback, useEffect, useState } from 'react';
import { invalidateAggregationCache } from '../../../lib/databaseAggregations';
import { loadAdminOverview } from './adminOverviewService';

export default function useAdminOverview(section, month) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '', key: '' });
  const key = section + ':' + month;
  const refresh = useCallback(() => {
    invalidateAggregationCache();
    setRevision(value => value + 1);
  }, []);
  useEffect(() => {
    let timer;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 180);
    };
    window.addEventListener('offline-sync-finished', schedule);
    window.addEventListener('insan-j-data-changed', schedule);
    window.addEventListener('online', schedule);
    window.addEventListener('offline', schedule);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('offline-sync-finished', schedule);
      window.removeEventListener('insan-j-data-changed', schedule);
      window.removeEventListener('online', schedule);
      window.removeEventListener('offline', schedule);
    };
  }, [refresh]);
  useEffect(() => {
    let current = true;
    setState({ loading: true, data: null, error: '', key });
    loadAdminOverview(section, month).then(data => {
      if (current) setState({ loading: false, data, error: '', key });
    }).catch(() => {
      if (current) setState({ loading: false, data: null, error: 'Data belum dapat dimuat. Periksa koneksi lalu coba lagi.', key });
    });
    return () => { current = false; };
  }, [section, month, revision, key]);
  return { ...(state.key === key ? state : { loading: true, data: null, error: '' }), refresh };
}
