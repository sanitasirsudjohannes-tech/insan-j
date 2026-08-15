import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useRiwayat({ user, isAdmin, selectedMonth }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRiwayat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tables = [
        { name: 'ruang_bangunan', formName: 'Ruang Bangunan', formId: 'ruang_bangunan' },
        { name: 'limbah_medis', formName: 'Pengolahan Limbah', formId: 'pengolahan_limbah' },
        { name: 'pemeriksaan_toilet', formName: 'Kebersihan Toilet', formId: 'toilet' },
        { name: 'pemeriksaan_reservoir', formName: 'Kebersihan Bak Reservoir', formId: 'reservoir' },
        { name: 'pemeriksaan_gizi', formName: 'Ceklist Gizi', formId: 'gizi' }
      ];

      const promises = tables.map(async (table) => {
        let query = supabase
          .from(table.name)
          .select('id, tanggal_pemeriksaan, ruangan, total, nilai_maks, persen, petugas, waktu_input');

        if (!isAdmin) {
          query = query.eq('petugas', user?.nama);
        }

        if (selectedMonth) {
          const startDate = `${selectedMonth}-01`;
          const dateObj = new Date(startDate);
          dateObj.setMonth(dateObj.getMonth() + 1);
          const endDate = dateObj.toISOString().split('T')[0];
          query = query.gte('tanggal_pemeriksaan', startDate).lt('tanggal_pemeriksaan', endDate);
        }

        const { data: resData, error: err } = await query;
        if (err) throw new Error(err.message);

        return (resData || []).map(item => ({
          id: `${table.name}_${item.id}`,
          originalId: item.id,
          tanggal: item.tanggal_pemeriksaan,
          formName: table.formName,
          formId: table.formId,
          tableName: table.name,
          lokasi: item.ruangan,
          nilai: item.total,
          maksimal: item.nilai_maks,
          persentase: item.persen ? parseFloat(item.persen) : 0,
          petugas: item.petugas,
          waktu_input: item.waktu_input
        }));
      });

      const results = await Promise.all(promises);
      const allData = results.flat().sort((a, b) => {
        const dateA = new Date(a.tanggal).getTime();
        const dateB = new Date(b.tanggal).getTime();
        if (dateB !== dateA) return dateB - dateA;

        const timeA = new Date(a.waktu_input || 0).getTime();
        const timeB = new Date(b.waktu_input || 0).getTime();
        return timeB - timeA;
      });

      setData(allData);
    } catch (err) {
      console.error(err);
      setError('Gagal memuat data dari server Supabase. ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.nama, isAdmin, selectedMonth]);

  useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  return { data, loading, error, fetchRiwayat, setData };
}
