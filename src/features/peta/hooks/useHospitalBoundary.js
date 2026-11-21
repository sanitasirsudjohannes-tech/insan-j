import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeHospitalBoundary } from '../domain/hospitalBoundary';
import { fetchHospitalBoundary } from '../services/hospitalBoundaryQueries';

export default function useHospitalBoundary() {
  const [boundary, setBoundary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const row = await fetchHospitalBoundary();
      if (requestId !== requestIdRef.current) return;
      setBoundary(normalizeHospitalBoundary(row));
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err?.message || 'Batas rumah sakit tidak dapat dimuat.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return { boundary, loading, error, refresh };
}
