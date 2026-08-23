import React, { useState, useEffect, useRef, useMemo } from 'react';
import AppLayout from '../components/AppLayout';
import { fetchAllRekapData, calculateRekapitulasi } from '../lib/rekapQueries';
import { buildRekapPrintHTML } from '../components/limbah/rekap/rekapPrintTemplate';
import { printViaHiddenIframe } from '../lib/printHelpers';
import { getSetting } from '../lib/api';
import RekapSummaryCards from '../components/limbah/rekap/RekapSummaryCards';
import RekapFilter from '../components/limbah/rekap/RekapFilter';
import RekapTable from '../components/limbah/rekap/RekapTable';
import Swal from 'sweetalert2';

export default function RekapLimbah() {
  const currentYearStr = String(new Date().getFullYear());
  const [allData, setAllData] = useState({ padatRows: [], ruanganRows: [], angkutRows: [] });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState('semua');
  const [isPrinting, setIsPrinting] = useState(false);

  const frameRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAllRekapData();
      setAllData(data);
    } catch (err) {
      console.error('Gagal mengambil data rekap:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleQueueChange = () => loadData();
    window.addEventListener('offline-queue-changed', handleQueueChange);
    window.addEventListener('online', handleQueueChange);
    window.addEventListener('offline', handleQueueChange);

    return () => {
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      window.removeEventListener('online', handleQueueChange);
      window.removeEventListener('offline', handleQueueChange);
    };
  }, []);

  const { availableYears, tableRows, summary, hasAnomaly } = useMemo(() => {
    return calculateRekapitulasi(allData, selectedYear, selectedMonth);
  }, [allData, selectedYear, selectedMonth]);

  // Adjust selectedYear if initial availableYears has years but current selectedYear is invalid
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears]);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const kepalaUnit = await getSetting('kepala_unit_sanitasi', null);
      const htmlContent = buildRekapPrintHTML(tableRows, summary, selectedYear, selectedMonth, kepalaUnit);
      await printViaHiddenIframe(htmlContent, frameRef);
    } catch (err) {
      console.error('Gagal mencetak rekap:', err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Cetak',
        text: 'Terjadi kesalahan saat memproses cetak laporan.'
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <AppLayout title="Rekap Limbah">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Rekap Limbah
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Rekapitulasi timbulan, pengangkutan, dan akumulasi limbah.
          </p>
        </div>

        {/* Filter Toolbar */}
        <RekapFilter
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          availableYears={availableYears}
          onPrint={handlePrint}
          isPrinting={isPrinting}
        />

        {/* Summary Cards */}
        <RekapSummaryCards summary={summary} />

        {/* Table & Anomaly Alert */}
        <RekapTable
          tableRows={tableRows}
          summary={summary}
          hasAnomaly={hasAnomaly}
          loading={loading}
        />
      </div>
    </AppLayout>
  );
}
