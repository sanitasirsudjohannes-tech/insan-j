import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeFacilities } from '../domain/facilityMapModel';
import { fetchCleanWaterMapLocations, fetchRoomMapLocations } from '../services/facilityMapQueries';

export default function useFacilityMapData() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const [rooms, cleanWaterLocations] = await Promise.all([
        fetchRoomMapLocations(),
        fetchCleanWaterMapLocations(),
      ]);
      if (requestId !== requestIdRef.current) return;
      setFacilities(mergeFacilities(rooms, cleanWaterLocations));
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err?.message || 'Data peta tidak dapat dimuat.');
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

  return { facilities, loading, error, refresh };
}
