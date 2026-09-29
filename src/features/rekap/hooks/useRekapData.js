import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { readDataFilters } from '../domain/rekapFilters';
import { fetchAllRekapData } from '../services/rekapService';
import { calculateRekapitulasi } from '../domain/rekapCalculations';
import { fetchRuanganRowsByMonth } from '../../../lib/limbah/rekapRuangan';
import { calculateRuanganSummary } from '../../../lib/limbah/rekapRuanganCalculations';
export default function useRekapData() {
  const { search } = useLocation();
  const currentYearStr = String(new Date().getFullYear());
  const [allData, setAllData] = useState({ padatRows: [], ruanganRows: [], angkutRows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const initialFilters = readDataFilters(search);
  const requestedMonth = initialFilters.month || (initialFilters.start && initialFilters.start.slice(0, 7) === initialFilters.end?.slice(0, 7) ? initialFilters.start.slice(0, 7) : '');
  const [selectedYear, setSelectedYear] = useState(() => requestedMonth?.slice(0, 4) || initialFilters.start?.slice(0, 4) || currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState(() => requestedMonth ? String(Number(requestedMonth.slice(5, 7))) : 'semua');
  const [activeTab, setActiveTab] = useState('bulanan');
  const [roomMonth, setRoomMonth] = useState(String(new Date().getMonth() + 1));
  const [roomRows, setRoomRows] = useState([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState('');

  const loadIdRef = useRef(0);
  const roomLoadIdRef = useRef(0);

  const loadData = useCallback(async () => {
    const currentLoadId = ++loadIdRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAllRekapData(selectedYear);
      if (currentLoadId !== loadIdRef.current) return;
      setAllData(data);
    } catch (err) {
      if (currentLoadId !== loadIdRef.current) return;
      setError(err.message || 'Rekap belum dapat dimuat. Coba kembali.');
    } finally {
      if (currentLoadId === loadIdRef.current) setLoading(false);
    }
  }, [selectedYear]);

  const loadRoomData = useCallback(async () => {
    const currentLoadId = ++roomLoadIdRef.current;
    setRoomLoading(true);
    setRoomError('');
    try {
      const rows = await fetchRuanganRowsByMonth(selectedYear, roomMonth);
      if (currentLoadId !== roomLoadIdRef.current) return;
      setRoomRows(calculateRuanganSummary(rows));
    } catch (error) {
      if (currentLoadId !== roomLoadIdRef.current) return;
      console.error('Gagal mengambil rekap per ruangan:', error);
      setRoomRows([]);
      setRoomError(error.message || 'Periksa koneksi lalu coba kembali.');
    } finally {
      if (currentLoadId === roomLoadIdRef.current) setRoomLoading(false);
    }
  }, [selectedYear, roomMonth]);

  useEffect(() => {
    loadData();

    let queueRefreshTimer;
    const relevantTables = new Set(['limbah_padat', 'limbah_ruangan', 'pengangkutan_limbah']);
    const handleQueueChange = (event) => {
      if (event.syncInProgress) return;
      const changedTables = event.changedTables || event.detail?.changedTables;
      if (changedTables?.length && !changedTables.some(table => relevantTables.has(table))) return;

      window.clearTimeout(queueRefreshTimer);
      queueRefreshTimer = window.setTimeout(loadData, 220);
    };
    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('offline-sync-finished', handleQueueChange);
    window.addEventListener('insan-j-data-changed', handleQueueChange);
    window.addEventListener('offline', handleQueueChange);

    return () => {
      loadIdRef.current += 1;
      window.clearTimeout(queueRefreshTimer);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('offline-sync-finished', handleQueueChange);
      window.removeEventListener('insan-j-data-changed', handleQueueChange);
      window.removeEventListener('offline', handleQueueChange);
    };
  }, [loadData]);

  useEffect(() => {
    if (activeTab !== 'ruangan') return undefined;
    loadRoomData();

    let refreshTimer;
    const handleDataChange = event => {
      if (event.syncInProgress) return;
      const changedTables = event.changedTables || event.detail?.changedTables;
      if (changedTables?.length && !changedTables.includes('limbah_ruangan')) return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(loadRoomData, 220);
    };
    window.addEventListener('offline-queue-changed', handleDataChange);
    window.addEventListener('offline-sync-finished', handleDataChange);
    window.addEventListener('insan-j-data-changed', handleDataChange);
    window.addEventListener('offline', handleDataChange);

    return () => {
      roomLoadIdRef.current += 1;
      window.clearTimeout(refreshTimer);
      window.removeEventListener('offline-queue-changed', handleDataChange);
      window.removeEventListener('offline-sync-finished', handleDataChange);
      window.removeEventListener('insan-j-data-changed', handleDataChange);
      window.removeEventListener('offline', handleDataChange);
    };
  }, [activeTab, loadRoomData]);

  const { availableYears, tableRows, summary, hasAnomaly } = useMemo(() => {
    return calculateRekapitulasi(allData, selectedYear, selectedMonth);
  }, [allData, selectedYear, selectedMonth]);

  // Adjust selectedYear if initial availableYears has years but current selectedYear is invalid
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  return { loading, error, loadData, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, activeTab, setActiveTab, roomMonth, setRoomMonth, roomRows, roomLoading, roomError, loadRoomData, availableYears, tableRows, summary, hasAnomaly };
}
